const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const SYSTEM_PROMPTS = {
  '/parse-inventory-label': `Você analisa etiquetas de peças automotivas da JAPAN.
Extraia:
- type: PRIMEIRAS DUAS PALAVRAS da descrição;
- code: número abaixo do código de barras, sem zeros à esquerda.
Ignore L: e F:.
Responda SOMENTE JSON: {"type":"...","code":"..."}`,

  '/parse-purchase-order': `Extraia pedido/orçamento/nota e responda SOMENTE JSON:
{
  "supplier":{"razaoSocial":"","cnpj":"","celular":"","endereco":"","cep":"","municipioUf":"","email":"","contato":"","obs":""},
  "items":[{"nome":"","valor":0,"quantidade":1,"marca":"","aplicacao":"","codigo":""}]
}
codigo = Cód. Fabricante/Part Number, nunca código interno.
marca = Fabricante; nome = Descrição; valor = V. Custo Unit.; quantidade = Qtd. Compra.
valor e quantidade numéricos.`,

  '/transcribe-image': `Extraia APENAS:
Nome / Razão Social
CPF / CNPJ
CEP
Tipo de Logradouro
Nome do Logradouro
Número
Complemento
Bairro
UF
Município
Formato: "Campo: valor", um por linha.
Omita campos ausentes. Se nenhum existir: "Nenhum dado de envio encontrado na imagem."`,
};

function parseImage(value, defaultMime) {
  const match = String(value).match(/^data:([^;,]+);base64,(.+)$/s);

  return {
    mimeType: match?.[1] || defaultMime,
    data: match?.[2] || String(value),
  };
}

function parseJson(text) {
  const cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();
  return JSON.parse(cleaned.match(/\{[\s\S]*\}/)?.[0] || cleaned);
}

async function callGemini(prompt, image, jsonMode) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada');
  }

  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

  const response = await fetch(`${API_URL}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }, { inlineData: image }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    console.error('Gemini HTTP:', response.status);
    throw new Error('Serviço de IA indisponível');
  }

  const result = await response.json();

  return (result.candidates?.[0]?.content?.parts || [])
    .map((part) => part.text || '')
    .join('\n')
    .trim();
}

export async function handleGeminiImage(path, body) {
  if (!Object.hasOwn(SYSTEM_PROMPTS, path)) {
    return { status: 404, body: { error: 'Rota desconhecida' } };
  }

  const isPurchaseOrder = path === '/parse-purchase-order';
  const source = isPurchaseOrder ? body.fileBase64 : body.imageBase64;

  if (typeof source !== 'string' || !source.trim()) {
    return {
      status: 400,
      body: { error: `${isPurchaseOrder ? 'fileBase64' : 'imageBase64'} obrigatório` },
    };
  }

  const image = parseImage(source, body.mimeType || (isPurchaseOrder ? 'image/png' : 'image/jpeg'));

  if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(image.mimeType)) {
    return {
      status: 400,
      body: { error: 'Formato de documento não suportado' },
    };
  }

  // Limite para evitar requisições excessivamente grandes.
  if (image.data.length > 10_000_000) {
    return {
      status: 413,
      body: { error: 'Documento muito grande' },
    };
  }

  try {
    const isText = path === '/transcribe-image';
    const prompt = isText
      ? 'Extraia os dados de envio.'
      : path === '/parse-purchase-order'
        ? 'Extraia fornecedor e itens deste documento.'
        : SYSTEM_PROMPTS[path];

    const response = await callGemini(
      isText
        ? `${SYSTEM_PROMPTS[path]}\n\n${prompt}`
        : path === '/parse-purchase-order'
          ? `${SYSTEM_PROMPTS[path]}\n\n${prompt}`
          : prompt,
      image,
      !isText
    );

    if (isText) {
      return { status: 200, body: { text: response || 'Nenhum texto encontrado.' } };
    }

    const parsed = parseJson(response);

    if (isPurchaseOrder) {
      return { status: 200, body: parsed };
    }

    return {
      status: 200,
      body: {
        type: String(parsed.type || '')
          .trim()
          .toUpperCase(),
        code: String(parsed.code || '')
          .trim()
          .replace(/^0+/, ''),
      },
    };
  } catch (error) {
    console.error('gemini-image', path, error);
    return {
      status: 502,
      body: { error: 'Não foi possível interpretar o documento com IA.' },
    };
  }
}
