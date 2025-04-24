const fs = require('fs-extra');
const path = require('path');
const { TEMP_DIR } = require('./fileUtils');

// Estilos de legendas predefinidos (apenas default por agora)
const subtitleStyles = {
  default: {
    fontName: 'Impact', // Fonte chamativa e bold
    fontSize: 42, // Tamanho maior para ser mais chamativo
    primaryColor: '&H00FFFFFF', // Branco
    highlightColor: '&H0000FFFF', // Amarelo para palavra destacada
    outlineColor: '&H00000000', // Contorno preto
    backColor: '&H80000000', // Preto semi-transparente
    bold: -1, // true
    outline: 3, // Contorno mais espesso para maior visibilidade
    shadow: 2, // Sombra para profundidade
    animation: 'fade' // Efeito de animação fade
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
    default: // default style
      primaryColor = '&H00FFFFFF';
      fontName = 'Impact';
      fontSize = 42;
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
  
  // Definir configurações específicas para o estilo default
  let primaryColor = '&H00FFFFFF'; // Branco por padrão
  let highlightColor = '&H0000FFFF'; // Amarelo para palavra destacada
  let fontName = 'Impact';
  let fontSize = 42;
  let bold = -1; // true
  let outline = 3;
  let shadow = 2;
  let backColor = '&H80000000'; // Preto semi-transparente
  let alignment = 2; // Centralizado horizontalmente, inferior (padrão)
  let animation = 'fade'; // Efeito de animação padrão
  
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
  
  // Aplicar configurações do estilo default
  primaryColor = subtitleStyles.default.primaryColor;
  highlightColor = subtitleStyles.default.highlightColor;
  fontName = subtitleStyles.default.fontName;
  fontSize = subtitleStyles.default.fontSize;
  bold = subtitleStyles.default.bold;
  outline = subtitleStyles.default.outline;
  shadow = subtitleStyles.default.shadow;
  backColor = subtitleStyles.default.backColor;
  animation = subtitleStyles.default.animation;

  // Substituir com valores personalizados se fornecidos
  if (subtitleOptions.highlightColor) {
    highlightColor = subtitleOptions.highlightColor;
  }
  
  if (subtitleOptions.animation) {
    animation = subtitleOptions.animation;
  }

  // Construir a definição de estilo
  const styleDefinition = `Style: Default,${fontName},${fontSize},${primaryColor},&H000000FF,&H00000000,${backColor},${bold},0,0,0,100,100,0,0,1,${outline},${shadow},${alignment},10,10,10,1`;
  console.log('Definição de estilo:', styleDefinition);

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
    styleDefinition,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  ];

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

  // Para cada frase, criar um único evento de diálogo com destaques sequenciais
  sentences.forEach((sentence) => {
    if (sentence.words.length === 0) return;

    const sentenceWords = sentence.words;
    const sentenceStartTime = sentenceWords[0].start;
    const sentenceEndTime = sentenceWords[sentenceWords.length - 1].end;

    // Texto completo da frase
    let sentenceText = sentenceWords.map(word => word.text).join(' ');

    // Dividir o texto em linhas com base em um limite de caracteres por linha
    const maxCharsPerLine = 30; // Ajuste conforme necessário
    const wordsInSentence = sentenceText.split(' ');
    let lines = [];
    let currentLine = [];

    wordsInSentence.forEach(word => {
      const testLine = [...currentLine, word].join(' ');
      if (testLine.length <= maxCharsPerLine) {
        currentLine.push(word);
      } else {
        lines.push(currentLine.join(' '));
        currentLine = [word];
      }
    });
    if (currentLine.length > 0) {
      lines.push(currentLine.join(' '));
    }

    // Juntar as linhas com quebras de linha manuais (\N)
    sentenceText = lines.join('\\N');

    // Construir o texto com tags de transformação para destacar palavras sequencialmente
    let formattedText = '';
    const allWords = sentenceText.split(/(\\N| )/); // Divide por espaços e quebras de linha
    let wordIndex = 0;

    // Inicializar todas as palavras com a cor primária e opacidade reduzida
    allWords.forEach((token, idx) => {
      if (token === '\\N') {
        formattedText += token; // Mantém a quebra de linha
        return;
      }
      if (token === '') return; // Ignora espaços extras

      const cleanToken = token.trim();
      if (wordIndex < sentenceWords.length && cleanToken === sentenceWords[wordIndex].text) {
        const word = sentenceWords[wordIndex];
        const relativeStart = word.start - sentenceStartTime;
        const relativeEnd = word.end - sentenceStartTime;

        // Aplicar animação para a palavra atual
        let animationTags = '';
        if (animation === 'fade') {
          animationTags = `\\c${primaryColor}\\alpha&H80&\\t(${relativeStart},${relativeEnd},\\c${highlightColor}\\alpha&H00&)\\t(${relativeEnd},${relativeEnd + 200},\\c${primaryColor}\\alpha&H80&)`;
        } else if (animation === 'scale') {
          animationTags = `\\c${primaryColor}\\alpha&H80&\\t(${relativeStart},${relativeEnd},\\c${highlightColor}\\fscx120\\fscy120)\\t(${relativeEnd},${relativeEnd + 200},\\c${primaryColor}\\fscx100\\fscy100)`;
        }

        formattedText += `{${animationTags}}${token}`;
        wordIndex++;
      } else {
        formattedText += `{\\c${primaryColor}\\alpha&H80&}${token}`;
      }

      // Adicionar espaço entre palavras, exceto após o último token ou antes de \N
      if (idx < allWords.length - 1 && allWords[idx + 1] !== '\\N') {
        formattedText += ' ';
      }
    });

    // Criar um único evento de diálogo para a frase inteira
    const dialogueLine = `Dialogue: 0,${formatTime(sentenceStartTime)},${formatTime(sentenceEndTime + 500)},Default,,0,0,0,,${formattedText}`;
    assContent.push(dialogueLine);
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