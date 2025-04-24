const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const DISABLE_AUTH = process.env.DISABLE_AUTH === 'true';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Erro: Variáveis de ambiente SUPABASE_URL e/ou SUPABASE_ANON_KEY não estão definidas. Verifique seu arquivo .env ou configurações de ambiente.');
  throw new Error('Configuração do Supabase incompleta.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Valida o token de autenticação do usuário ou chave de API permanente.
 * @param {string} authHeader - Cabeçalho de autorização com o token ou chave.
 * @returns {Promise<Object>} - Objeto com informações do usuário ou erro.
 */
async function validateUserToken(authHeader) {
  if (DISABLE_AUTH) {
    console.log('Autenticação desativada para testes. Usando usuário de teste.');
    return { user: { id: '9939d25e-82e5-40da-9590-fcb2d84f7d11' } };
  }

  console.log('Cabeçalho de autorização recebido:', authHeader ? 'Cabeçalho presente (valor oculto por segurança)' : 'Cabeçalho ausente');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Erro: Token ou chave API ausente ou inválido no cabeçalho.');
    return { error: 'Token de autenticação ou chave API ausente ou inválido', status: 401 };
  }

  const credential = authHeader.split(' ')[1];
  if (!credential) {
    console.log('Erro: Credencial ausente após "Bearer " no cabeçalho de autorização.');
    return { error: 'Credencial ausente no cabeçalho de autorização', status: 401 };
  }

  console.log('Credencial recebida (tipo detectado):', credential.split('.').length === 3 ? 'Token JWT detectado' : 'Chave API detectada (não JWT)');

  // Tenta validar como token JWT primeiro, apenas se tiver 3 partes
  if (credential.split('.').length === 3) {
    console.log('Tentando validar como token JWT...');
    try {
      const { data: { user }, error } = await supabase.auth.getUser(credential);

      if (error) {
        console.error('Erro ao verificar token JWT:', error.message);
        if (error.message.includes('invalid JWT')) {
          console.log('Token JWT inválido ou malformado.');
          return { error: 'Token JWT inválido ou malformado', status: 401 };
        }
        console.log('Token JWT inválido ou expirado.');
        return { error: 'Token inválido ou expirado', status: 401 };
      }

      if (!user) {
        console.log('Usuário não encontrado com esse token JWT.');
        return { error: 'Usuário não encontrado', status: 404 };
      }

      console.log('Token JWT validado com sucesso, usuário encontrado:', user.id);
      return { user };
    } catch (err) {
      console.error('Erro inesperado ao validar token JWT:', err.message);
      // Continua para tentar validar como chave API
      console.log('Erro ao validar como JWT, tentando validar como chave API...');
    }
  } else {
    console.log('Credencial não tem formato de JWT (não possui 3 partes), tentando como chave API diretamente...');
  }

  // Tenta validar como chave API
  console.log('Tentando validar como chave API...');
  try {
    const { data: userData, error } = await supabase
      .from('users')
      .select('id')
      .eq('api_key', credential)
      .single();

    if (error) {
      console.error('Erro ao buscar usuário por chave API:', error.message);
      return { error: 'Chave API inválida ou erro na busca', status: 401 };
    }

    if (!userData) {
      console.log('Nenhum usuário encontrado com a chave API fornecida.');
      return { error: 'Usuário não encontrado com essa chave API', status: 401 };
    }

    console.log('Chave API validada com sucesso, usuário encontrado:', userData.id);
    return { user: { id: userData.id } };
  } catch (err) {
    console.error('Erro inesperado ao validar chave API:', err.message);
    return { error: 'Erro interno ao validar credencial', status: 500 };
  }
}

/**
 * Verifica se o usuário tem créditos suficientes.
 * @param {string} userId - ID do usuário.
 * @param {number} requiredCredits - Número de créditos necessários.
 * @returns {Promise<Object>} - Resultado da verificação de créditos.
 */
async function checkUserCredits(userId, requiredCredits = 1) {
  try {
    const { data: userData, error } = await supabase
      .from('users')
      .select('credits')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Erro ao buscar créditos do usuário:', error.message);
      return { error: 'Erro ao verificar créditos', status: 500 };
    }

    if (!userData || userData.credits < requiredCredits) {
      return { error: 'Créditos insuficientes', status: 402 };
    }

    return { success: true, credits: userData.credits };
  } catch (err) {
    console.error('Erro inesperado ao verificar créditos:', err.message);
    return { error: 'Erro interno ao verificar créditos', status: 500 };
  }
}

/**
 * Deduz créditos do usuário após uso.
 * @param {string} userId - ID do usuário.
 * @param {number} creditsToDeduct - Número de créditos a deduzir.
 * @returns {Promise<Object>} - Resultado da operação de dedução.
 */
async function deductUserCredits(userId, creditsToDeduct = 1) {
  try {
    const { data: userData, error: selectError } = await supabase
      .from('users')
      .select('credits')
      .eq('id', userId)
      .single();

    if (selectError) {
      console.error('Erro ao buscar créditos do usuário para dedução:', selectError.message);
      return { error: 'Erro ao deduzir créditos', status: 500 };
    }

    if (!userData || userData.credits < creditsToDeduct) {
      return { error: 'Créditos insuficientes para dedução', status: 402 };
    }

    const newCredits = userData.credits - creditsToDeduct;
    const { data: updateData, error: updateError } = await supabase
      .from('users')
      .update({ credits: newCredits })
      .eq('id', userId);

    if (updateError) {
      console.error('Erro ao atualizar créditos do usuário:', updateError.message);
      return { error: 'Erro ao deduzir créditos', status: 500 };
    }

    console.log(`Créditos deduzidos: ${creditsToDeduct}. Novos créditos: ${newCredits}`);
    return { success: true, newCredits };
  } catch (err) {
    console.error('Erro inesperado ao deduzir créditos:', err.message);
    return { error: 'Erro interno ao deduzir créditos', status: 500 };
  }
}

module.exports = { validateUserToken, checkUserCredits, deductUserCredits };
