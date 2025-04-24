const fs = require('fs-extra');
const path = require('path');
const { TEMP_DIR } = require('./fileUtils');

// Estilos de legendas predefinidos
const subtitleStyles = {
  default: {
    fontName: 'Roboto Bold',
    fontSize: 30,
    primaryColor: '&H00FFFFFF', // Branco
    outlineColor: '&H00000000', // Preto
    backColor: '&H80000000', // Preto semi-transparente
    bold: -1, // true
    outline: 2,
    shadow: 1
  },
  retro: {
    fontName: 'Arial Black',
    fontSize: 36,
    primaryColor: '&H000000FF', // Vermelho
    outlineColor: '&H00000000', // Preto
    backColor: '&H80000000', // Preto semi-transparente
    bold: -1,
    outline: 2,
    shadow: 1
  },
  neon: {
    fontName: 'Impact',
    fontSize: 32,
    primaryColor: '&H00FF8000', // Azul neon
    outlineColor: '&H00000000', // Preto
    backColor: '&H00000000', // Transparente
    bold: -1,
    outline: 2,
    shadow: 3
  },
  minimal: {
    fontName: 'Arial',
    fontSize: 28,
    primaryColor: '&H00FFFFFF', // Branco
    outlineColor: '&H00000000', // Preto
    backColor: '&H00000000', // Transparente
    bold: 0, // false
    outline: 1,
    shadow: 0
  },
  modern: {
    fontName: 'Segoe UI',
    fontSize: 30,
    primaryColor: '&H00FFFFFF', // Branco
    outlineColor: '&H00000000', // Preto
    backColor: '&H40000000', // Preto semi-transparente
    bold: -1,
    outline: 1,
    shadow: 1
  },
  subtle: {
    fontName: 'Calibri',
    fontSize: 24,
    primaryColor: '&H00FFFFFF', // Branco
    outlineColor: '&H00000000', // Preto
    backColor: '&H00000000', // Transparente
    bold: 0, // false
    outline: 1,
    shadow: 0
  },
  emoji: {
    fontName: 'Segoe UI Emoji',
    fontSize: 30,
    primaryColor: '&H00FFFFFF', // Branco
    outlineColor: '&H00000000', // Preto
    backColor: '&H00000000', // Transparente
    bold: -1,
    outline: 2,
    shadow: 1
  },
  tiktok: {
    fontName: 'Segoe UI Black',
    fontSize: 36,
    primaryColor: '&H008080FF', // Rosa
    outlineColor: '&H00000000', // Preto
    backColor: '&H80000000', // Preto semi-transparente
    bold: -1,
    outline: 2,
    shadow: 1
  },
  youtuber: {
    fontName: 'Impact',
    fontSize: 42,
    primaryColor: '&H0000FFFF', // Amarelo
    outlineColor: '&H00000000', // Preto
    backColor: '&H80000000', // Preto semi-transparente
    bold: -1,
    outline: 3,
    shadow: 3
  },
  movie: {
    fontName: 'Times New Roman',
    fontSize: 38,
    primaryColor: '&H00FFFFFF', // Branco
    outlineColor: '&H00000000', // Preto
    backColor: '&H80000000', // Preto semi-transparente
    bold: -1,
    outline: 1,
    shadow: 3
  },
  capcut: {
    fontName: 'Montserrat Bold',
    fontSize: 40,
    primaryColor: '&H00FFFFFF', // Branco
    highlightColor: '&H000080FF', // Laranja para palavra destacada
    outlineColor: '&H00000000', // Preto
    backColor: '&H60000000', // Preto semi-transparente
    bold: -1,
    outline: 2,
    shadow: 1,
    animation: 'pop' // Efeito de animação pop
  },
  capcut_neon: {
    fontName: 'Montserrat ExtraBold',
    fontSize: 38,
    primaryColor: '&H00FFFFFF', // Branco
    highlightColor: '&H0000FFFF', // Amarelo para palavra destacada
    outlineColor: '&H00000000', // Preto
    backColor: '&H40000000', // Preto semi-transparente
    bold: -1,
    outline: 2,
    shadow: 2,
    animation: 'glow' // Efeito de brilho
  },
  capcut_minimal: {
    fontName: 'Roboto',
    fontSize: 36,
    primaryColor: '&H00FFFFFF', // Branco
    highlightColor: '&H000080FF', // Laranja para palavra destacada
    outlineColor: '&H00000000', // Preto
    backColor: '&H00000000', // Transparente
    bold: -1,
    outline: 1,
    shadow: 0,
    animation: 'slide' // Efeito de deslizamento
  }
};

// Função para formatar tempo em formato ASS (H:MM:SS.CC)
const formatTime = (ms) => {
  const totalSeconds = ms / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const centiseconds = Math.floor((ms % 1000) / 10);
  
  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
};

// Função para criar arquivo ASS a partir de texto narrativo
const createASSFile = (text, outputPath, duration, subtitleOptions = {}) => {
  if (!text) {
    console.log('Nenhum texto fornecido para criar legendas.');
    return Promise.resolve();
  }

  // Definir estilo com base no nome
  const styleName = subtitleOptions.styleName || 'default';
  console.log(`Aplicando estilo: ${styleName}`);
  
  // Definir posição com base nas opções
  const position = subtitleOptions.position || 'bottom';
  console.log(`Aplicando posição: ${position}`);
  
  // Definir configurações específicas para cada estilo
  let primaryColor = '&H00FFFFFF'; // Branco por padrão
  let fontName = 'Arial';
  let fontSize = 30;
  let bold = -1; // true
  let outline = 2;
  let shadow = 1;
  let backColor = '&H80000000'; // Preto semi-transparente
  let alignment = 2; // Centralizado horizontalmente, inferior (padrão)
  
  // Definir alinhamento baseado na posição
  switch (position.toLowerCase()) {
    case 'top':
      alignment = 8; // Centralizado horizontalmente, topo
      break;
    case 'center':
      alignment = 5; // Centralizado horizontal e verticalmente
      break;
    case 'bottom':
    default:
      alignment = 2; // Centralizado horizontalmente, inferior
      break;
  }
  
  // Cores no formato ASS: &HAABBGGRR (Alpha, Blue, Green, Red)
  switch (styleName) {
    case 'retro':
      // Vermelho
      primaryColor = '&H000000FF';
      fontName = 'Arial Black';
      fontSize = 36;
      backColor = '&H80000000'; // Preto semi-transparente
      break;
      
    case 'neon':
      // Azul neon
      primaryColor = '&H00FF8000';
      fontName = 'Impact';
      fontSize = 32;
      outline = 2;
      shadow = 3;
      backColor = '&H00000000'; // Transparente
      break;
      
    case 'minimal':
      primaryColor = '&H00FFFFFF';
      fontName = 'Arial';
      fontSize = 28;
      bold = 0; // false
      outline = 1;
      shadow = 0;
      backColor = '&H00000000'; // Transparente
      break;
      
    case 'modern':
      primaryColor = '&H00FFFFFF';
      fontName = 'Segoe UI';
      fontSize = 30;
      backColor = '&H40000000'; // Preto semi-transparente
      outline = 1;
      shadow = 1;
      break;
      
    case 'subtle':
      primaryColor = '&H00FFFFFF';
      fontName = 'Calibri';
      fontSize = 24;
      bold = 0; // false
      outline = 1;
      shadow = 0;
      backColor = '&H00000000'; // Transparente
      break;
      
    case 'emoji':
      primaryColor = '&H00FFFFFF';
      fontName = 'Segoe UI Emoji';
      fontSize = 30;
      outline = 2;
      shadow = 1;
      backColor = '&H00000000'; // Transparente
      break;
      
    case 'retro':
      primaryColor = '&H0000FFFF';
      fontName = 'Arial Black';
      fontSize = 36;
      outline = 2;
      shadow = 1;
      backColor = '&H80000000'; // Preto semi-transparente
      break;
      
    case 'tiktok':
      // Rosa
      primaryColor = '&H008080FF';
      fontName = 'Segoe UI Black';
      fontSize = 36;
      backColor = '&H80000000'; // Preto semi-transparente
      break;
      
    case 'youtuber':
      // Amarelo
      primaryColor = '&H0000FFFF';
      fontName = 'Impact';
      fontSize = 42;
      outline = 3;
      shadow = 3;
      break;
      
    case 'movie':
      // Branco com sombra maior
      primaryColor = '&H00FFFFFF';
      fontName = 'Times New Roman';
      fontSize = 38;
      outline = 1;
      shadow = 3;
      break;
      
    default: // default style
      // Branco
      primaryColor = '&H00FFFFFF';
      fontName = 'Roboto Bold';
      fontSize = 30;
      break;
  }

  // Construir a definição de estilo
  const styleDefinition = `Style: Default,${fontName},${fontSize},${primaryColor},&H000000FF,&H00000000,${backColor},${bold},0,0,0,100,100,0,0,1,${outline},${shadow},${alignment},10,10,10,1`;
  console.log('Definição de estilo:', styleDefinition);

  // Criar conteúdo do arquivo ASS
  const assContent = [
    '[Script Info]',
    '; Script gerado automaticamente',
    'ScriptType: v4.00+',
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    'YCbCr Matrix: TV.601',
    'PlayResX: 1280',
    'PlayResY: 720',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    styleDefinition,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  ];

  // Calcular tempo por caractere (para distribuir o texto ao longo da duração)
  const timePerChar = duration * 1000 / text.length;
  
  // Dividir o texto em frases (baseado em pontuação)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  let startTime = 0;
  sentences.forEach((sentence) => {
    const sentenceLength = sentence.length;
    const sentenceDuration = sentenceLength * timePerChar;
    const endTime = startTime + sentenceDuration;
    
    // Criar evento de diálogo para a frase
    const dialogueLine = `Dialogue: 0,${formatTime(startTime)},${formatTime(endTime)},Default,,0,0,0,,${sentence.trim()}`;
    assContent.push(dialogueLine);
    
    startTime = endTime;
  });

  // Escrever o arquivo ASS
  return fs.writeFile(outputPath, assContent.join('\n'))
    .then(() => {
      console.log(`Arquivo ASS criado com sucesso em: ${outputPath}`);
    })
    .catch(err => {
      console.error(`Erro ao criar arquivo ASS: ${err.message}`);
      throw err;
    });
};

// Função para criar arquivo ASS a partir de transcrição com timestamps
const createASSFileFromTranscription = (transcription, outputPath, duration, subtitleOptions = {}) => {
  const words = transcription.utterances ? transcription.utterances.flatMap(u => u.words) : transcription.words;
  if (!words || words.length === 0) {
    console.log('Nenhuma palavra encontrada na transcrição para criar legendas.');
    return Promise.resolve();
  }

  console.log('Dados de transcrição recebidos:', JSON.stringify(words, null, 2));
  console.log('Opções de legendas recebidas:', JSON.stringify(subtitleOptions, null, 2));

  // Definir estilo com base no nome
  const styleName = subtitleOptions.styleName || 'default';
  console.log(`Aplicando estilo: ${styleName}`);
  
  // Definir posição com base nas opções
  const position = subtitleOptions.position || 'bottom';
  console.log(`Aplicando posição: ${position}`);
  
  // Verificar se deve usar o estilo CapCut (destaque de palavras)
  const useCapcutStyle = true;
  
  // Definir configurações específicas para cada estilo
  let primaryColor = '&H00FFFFFF'; // Branco por padrão
  let highlightColor = '&H000080FF'; // Laranja para palavra destacada
  let fontName = 'Arial';
  let fontSize = 30;
  let bold = -1; // true
  let outline = 2;
  let shadow = 1;
  let backColor = '&H80000000'; // Preto semi-transparente
  let alignment = 2; // Centralizado horizontalmente, inferior (padrão)
  let animation = 'pop'; // Efeito de animação pop por padrão
  
  // Definir alinhamento baseado na posição
  switch (position.toLowerCase()) {
    case 'top':
      alignment = 8; // Centralizado horizontalmente, topo
      break;
    case 'center':
      alignment = 5; // Centralizado horizontal e verticalmente
      break;
    case 'bottom':
    default:
      alignment = 2; // Centralizado horizontalmente, inferior
      break;
  }
  
  // Cores no formato ASS: &HAABBGGRR (Alpha, Blue, Green, Red)
  switch (styleName) {
    case 'retro':
      // Vermelho
      primaryColor = '&H000000FF';
      highlightColor = '&H00FFFFFF'; // Branco para destaque
      fontName = 'Arial Black';
      fontSize = 36;
      backColor = '&H80000000'; // Preto semi-transparente
      animation = 'pop';
      break;
      
    case 'neon':
      // Azul neon
      primaryColor = '&H00FF8000';
      highlightColor = '&H00FFFFFF'; // Branco para destaque
      fontName = 'Impact';
      fontSize = 32;
      outline = 2;
      shadow = 3;
      backColor = '&H00000000'; // Transparente
      animation = 'glow';
      break;
      
    case 'minimal':
      primaryColor = '&H00FFFFFF';
      highlightColor = '&H000080FF'; // Laranja para destaque
      fontName = 'Arial';
      fontSize = 28;
      bold = 0; // false
      outline = 1;
      shadow = 0;
      backColor = '&H00000000'; // Transparente
      animation = 'slide';
      break;
      
    case 'modern':
      primaryColor = '&H00FFFFFF';
      highlightColor = '&H0000FFFF'; // Amarelo para destaque
      fontName = 'Segoe UI';
      fontSize = 30;
      backColor = '&H40000000'; // Preto semi-transparente
      outline = 1;
      shadow = 1;
      animation = 'pop';
      break;
      
    case 'subtle':
      primaryColor = '&H00FFFFFF';
      highlightColor = '&H00CCCCCC'; // Cinza claro para destaque
      fontName = 'Calibri';
      fontSize = 24;
      bold = 0; // false
      outline = 1;
      shadow = 0;
      backColor = '&H00000000'; // Transparente
      animation = 'slide';
      break;
      
    case 'emoji':
      primaryColor = '&H00FFFFFF';
      highlightColor = '&H0000FFFF'; // Amarelo para destaque
      fontName = 'Segoe UI Emoji';
      fontSize = 30;
      outline = 2;
      shadow = 1;
      backColor = '&H00000000'; // Transparente
      animation = 'pop';
      break;
      
    case 'tiktok':
      // Rosa
      primaryColor = '&H008080FF';
      highlightColor = '&H000000FF'; // Vermelho para destaque
      fontName = 'Segoe UI Black';
      fontSize = 36;
      backColor = '&H80000000'; // Preto semi-transparente
      animation = 'pop';
      break;
      
    case 'youtuber':
      // Amarelo
      primaryColor = '&H0000FFFF';
      highlightColor = '&H00FFFFFF'; // Branco para destaque
      fontName = 'Impact';
      fontSize = 42;
      outline = 3;
      shadow = 3;
      animation = 'glow';
      break;
      
    case 'movie':
      // Branco com sombra maior
      primaryColor = '&H00FFFFFF';
      highlightColor = '&H0000FFFF'; // Amarelo para destaque
      fontName = 'Times New Roman';
      fontSize = 38;
      outline = 1;
      shadow = 3;
      animation = 'pop';
      break;
      
    case 'capcut':
      primaryColor = '&H00FFFFFF'; // Branco
      highlightColor = '&H000080FF'; // Laranja para palavra destacada
      fontName = 'Montserrat Bold';
      fontSize = 40;
      outline = 2;
      shadow = 1;
      backColor = '&H60000000'; // Preto semi-transparente
      animation = 'pop';
      break;
      
    case 'capcut_neon':
      primaryColor = '&H00FFFFFF'; // Branco
      highlightColor = '&H0000FFFF'; // Amarelo para palavra destacada
      fontName = 'Montserrat ExtraBold';
      fontSize = 38;
      outline = 2;
      shadow = 2;
      backColor = '&H40000000'; // Preto semi-transparente
      animation = 'glow';
      break;
      
    case 'capcut_minimal':
      primaryColor = '&H00FFFFFF'; // Branco
      highlightColor = '&H000080FF'; // Laranja para palavra destacada
      fontName = 'Roboto';
      fontSize = 36;
      outline = 1;
      shadow = 0;
      backColor = '&H00000000'; // Transparente
      animation = 'slide';
      break;
      
    default: // default style
      // Branco
      primaryColor = '&H00FFFFFF';
      highlightColor = '&H0000FFFF'; // Amarelo para destaque
      fontName = 'Roboto Bold';
      fontSize = 30;
      animation = 'pop';
      break;
  }

  // Substituir com valores personalizados se fornecidos
  if (subtitleOptions.highlightColor) {
    highlightColor = subtitleOptions.highlightColor;
  }
  
  if (subtitleOptions.animation) {
    animation = subtitleOptions.animation;
  }

  // Construir a definição de estilo principal
  const styleDefinition = `Style: Default,${fontName},${fontSize},${primaryColor},&H000000FF,&H00000000,${backColor},${bold},0,0,0,100,100,0,0,1,${outline},${shadow},${alignment},10,10,10,1`;
  console.log('Definição de estilo:', styleDefinition);
  
  // Construir a definição de estilo para palavras destacadas
  const highlightStyleDefinition = `Style: Highlight,${fontName},${fontSize},${highlightColor},&H000000FF,&H00000000,${backColor},${bold},0,0,0,100,100,0,0,1,${outline},${shadow},${alignment},10,10,10,1`;

  // Criar conteúdo do arquivo ASS
  const assContent = [
    '[Script Info]',
    '; Script gerado automaticamente a partir de transcrição',
    'ScriptType: v4.00+',
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    'YCbCr Matrix: TV.601',
    'PlayResX: 1280',
    'PlayResY: 720',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    styleDefinition
  ];
  
  // Adicionar estilo de destaque se estiver usando o estilo CapCut
  if (useCapcutStyle) {
    assContent.push(highlightStyleDefinition);
  }
  
  assContent.push('', '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text');

  // Modo CapCut: cada palavra tem seu próprio evento de diálogo com destaque
  // Agrupar palavras em frases completas (baseado em pontuação ou pausas longas)
  const sentences = [];
  let currentSentence = [];

  words.forEach((word, index) => {
    currentSentence.push(word);
    // Verificar se a palavra termina com pontuação ou se há uma pausa longa até a próxima palavra
    const nextWord = index < words.length - 1 ? words[index + 1] : null;
    if (word.text.match(/[.!?]$/) || (nextWord && nextWord.start - word.end > 500)) {
      sentences.push({
        words: [...currentSentence]
      });
      currentSentence = [];
    }
  });

  // Adicionar qualquer frase restante
  if (currentSentence.length > 0) {
    sentences.push({
      words: [...currentSentence]
    });
  }
  
  // Para cada frase, criar eventos de diálogo para cada palavra e para a frase completa
  sentences.forEach((sentence) => {
    if (sentence.words.length === 0) return;
    
    const sentenceWords = sentence.words;
    const startTime = formatTime(sentenceWords[0].start);
    const endTime = formatTime(sentenceWords[sentenceWords.length - 1].end);
    
    // Texto completo da frase para o fundo
    const sentenceText = sentenceWords.map(word => word.text).join(' ');
    
    // Criar evento de diálogo para a frase completa (fundo)
    const dialogueLine = `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${sentenceText}`;
    assContent.push(dialogueLine);
    
    // Criar eventos de diálogo para cada palavra com destaque
    sentenceWords.forEach((word) => {
      const wordStartTime = formatTime(word.start);
      const wordEndTime = formatTime(word.end);
      
      // Calcular a posição da palavra na frase
      const wordIndex = sentenceText.indexOf(word.text);
      if (wordIndex >= 0) {
        // Criar texto com tags ASS para destacar apenas a palavra atual
        let highlightText = sentenceText;
        
        // Aplicar efeito de animação se especificado
        let animationTags = '';
        if (animation === 'pop') {
          animationTags = '{\\t(0,60,\\fscx115\\fscy115)\\t(60,120,\\fscx100\\fscy100)}';
        } else if (animation === 'glow') {
          animationTags = '{\\t(0,120,\\3c&H00FFFF&\\4a&H00&)\\t(120,240,\\3c&H000000&\\4a&H80&)}';
        } else if (animation === 'slide') {
          animationTags = '{\\move(' + (alignment === 2 ? '640,680,640,650' : alignment === 5 ? '640,380,640,360' : '640,80,640,50') + ')}';
        }
        
        // Criar texto com a palavra destacada
        const beforeWord = highlightText.substring(0, wordIndex);
        const afterWord = highlightText.substring(wordIndex + word.text.length);
        
        highlightText = `${beforeWord}{\\c${highlightColor}${animationTags}}${word.text}{\\c${primaryColor}}${afterWord}`;
        
        // Criar evento de diálogo para a palavra destacada
        const wordDialogueLine = `Dialogue: 1,${wordStartTime},${wordEndTime},Default,,0,0,0,,${highlightText}`;
        assContent.push(wordDialogueLine);
      }
    });
  });

  // Escrever o arquivo ASS
  return fs.writeFile(outputPath, assContent.join('\n'))
    .then(() => {
      console.log(`Arquivo ASS de transcrição criado com sucesso em: ${outputPath}`);
    })
    .catch(err => {
      console.error(`Erro ao criar arquivo ASS: ${err.message}`);
      throw err;
    });
};

module.exports = { subtitleStyles, createASSFile, createASSFileFromTranscription };
