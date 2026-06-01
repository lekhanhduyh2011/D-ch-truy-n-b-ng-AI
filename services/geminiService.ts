
import { GoogleGenAI, Type } from "@google/genai";
import { TranslationResult, SourceLanguage } from "../types";

const getSystemInstruction = (lang: SourceLanguage, isHanViet: boolean = false) => `
Bạn là một chuyên gia dịch thuật tiểu thuyết chuyên nghiệp, có thâm niên trong việc chuyển ngữ các tác phẩm Tu Tiên, Kiếm Hiệp và Ngôn Tình.

NHIỆM VỤ:
${isHanViet 
  ? `1. Chuốt lại văn bản Hán Việt sang tiếng Việt thuần Việt, mượt mà, thoát ý.
2. Giữ nguyên tên riêng (nhân vật, địa danh, chiêu thức) dạng Hán Việt.`
  : `1. Dịch văn bản từ ${lang === 'CN' ? 'tiếng Trung' : 'tiếng Anh'} sang tiếng Việt mượt mà.
2. Quy tắc tên riêng: ${lang === 'CN' ? 'Bắt buộc dùng âm Hán Việt cho tên người/địa danh.' : 'Giữ nguyên tên gốc tiếng Anh.'}
3. Xưng hô: Phù hợp ngữ cảnh (đối thoại cổ trang hoặc hiện đại).`}

YÊU CẦU QUAN TRỌNG:
- KHÔNG ĐƯỢC BỎ SÓT bất kỳ câu văn nào.
- Đảm bảo tính nhất quán của các danh từ riêng đã được dịch trước đó (nếu có danh sách đính kèm).
- Trả về JSON theo đúng cấu trúc yêu cầu.
`;

const CHUNK_SIZE = 4000; // Khoảng 2000-3000 từ mỗi lần gửi để an toàn cho Gateway

export const translateNovel = async (
  input: string | { data: string; mimeType: string },
  sourceLang: SourceLanguage,
  isImage: boolean = false,
  customInstruction: string = "",
  genre: string = "Tự động nhận diện",
  style: string = "Tự động nhận diện",
  isHanViet: boolean = false,
  onProgress?: (current: number, total: number) => void
): Promise<TranslationResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  const modelName = "gemini-3-flash-preview";

  // Nếu là ảnh, dịch trực tiếp (thường ảnh không quá dài)
  if (isImage && typeof input !== 'string') {
    return callGemini(ai, modelName, input, sourceLang, isHanViet, customInstruction, genre, style);
  }

  const text = typeof input === 'string' ? input : '';
  
  // Nếu văn bản ngắn, dịch một lần
  if (text.length <= CHUNK_SIZE) {
    return callGemini(ai, modelName, text, sourceLang, isHanViet, customInstruction, genre, style);
  }

  // Nếu văn bản dài (lên đến 12,000 từ), tiến hành chia nhỏ
  const chunks = splitText(text, CHUNK_SIZE);
  let finalContent = "";
  let chapterInfo = { title: "", chapterNumber: "", chapterName: "" };
  let glossary = ""; // Lưu trữ danh từ riêng để nhất quán giữa các chunk

  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) onProgress(i + 1, chunks.length);

    const prompt = `Đây là PHẦN ${i + 1}/${chunks.length} của chương truyện.
${glossary ? `DANH SÁCH TỪ VỰNG ĐÃ DÙNG Ở PHẦN TRƯỚC (Hãy tuân thủ): \n${glossary}\n` : ""}
NỘI DUNG CẦN DỊCH:
${chunks[i]}`;

    const result = await callGemini(ai, modelName, prompt, sourceLang, isHanViet, customInstruction, genre, style);
    
    finalContent += result.content + "\n\n";
    
    // Lấy thông tin chương từ phần đầu tiên
    if (i === 0) {
      chapterInfo = {
        title: result.title,
        chapterNumber: result.chapterNumber,
        chapterName: result.chapterName
      };
    }

    // Cập nhật tóm tắt danh từ riêng cho các phần sau (yêu cầu AI trích xuất nhanh)
    if (i < chunks.length - 1) {
      glossary += await extractGlossary(ai, modelName, result.content);
    }
  }

  return {
    ...chapterInfo,
    content: finalContent.trim()
  };
};

// Hàm gọi API Gemini cơ bản
async function callGemini(
  ai: any,
  model: string,
  input: string | { data: string; mimeType: string },
  sourceLang: SourceLanguage,
  isHanViet: boolean,
  customInstruction: string,
  genre: string,
  style: string
): Promise<TranslationResult> {
  const contents = typeof input === 'string' 
    ? { parts: [{ text: input }] }
    : { parts: [{ inlineData: input }, { text: "Dịch nội dung ảnh này." }] };

  const response = await ai.models.generateContent({
    model: model,
    contents,
    config: {
      systemInstruction: getSystemInstruction(sourceLang, isHanViet) + `\nYêu cầu bổ sung: ${customInstruction}. Thể loại: ${genre}. Văn phong: ${style}.`,
      responseMimeType: "application/json",
      maxOutputTokens: 8000, // Giới hạn vừa đủ để tránh lỗi 500
      thinkingConfig: { thinkingBudget: 0 },
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          chapterNumber: { type: Type.STRING },
          chapterName: { type: Type.STRING },
          content: { type: Type.STRING },
        },
        required: ["content", "title", "chapterNumber", "chapterName"],
      },
    },
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    // Fallback nếu JSON bị lỗi nhẹ
    const repaired = tryRepairJson(response.text);
    return JSON.parse(repaired);
  }
}

// Trích xuất glossary để đảm bảo nhất quán
async function extractGlossary(ai: any, model: string, translatedText: string): Promise<string> {
  const resp = await ai.models.generateContent({
    model: model,
    contents: `Trích xuất danh sách tên riêng/danh từ quan trọng từ đoạn văn sau dưới dạng "Gốc: Dịch". Chỉ liệt kê tối đa 10 mục quan trọng nhất.\n\nVăn bản: ${translatedText.substring(0, 1000)}`,
    config: { maxOutputTokens: 200 }
  });
  return resp.text + "\n";
}

function splitText(text: string, size: number): string[] {
  const chunks: string[] = [];
  let currentIndex = 0;
  while (currentIndex < text.length) {
    let end = currentIndex + size;
    if (end < text.length) {
      // Tìm điểm ngắt dòng gần nhất để không ngắt giữa câu
      const lastNewline = text.lastIndexOf('\n', end);
      if (lastNewline > currentIndex) end = lastNewline;
    }
    chunks.push(text.substring(currentIndex, end));
    currentIndex = end;
  }
  return chunks;
}

const tryRepairJson = (jsonStr: string): string => {
  let repaired = jsonStr.trim();
  if (!repaired.endsWith('}')) {
    if (repaired.endsWith(',')) repaired = repaired.slice(0, -1);
    const quoteCount = (repaired.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) repaired += '"';
    repaired += '}';
  }
  return repaired;
};
