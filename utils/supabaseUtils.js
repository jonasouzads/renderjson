const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Erro: Variáveis de ambiente SUPABASE_URL e/ou SUPABASE_ANON_KEY não estão definidas. Verifique seu arquivo .env ou configurações de ambiente.');
  throw new Error('Configuração do Supabase incompleta.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Atualiza ou insere o status do processo no Supabase.
 * @param {string} processId - ID do processo.
 * @param {string} status - Status do processo.
 * @param {Object} details - Detalhes adicionais do processo.
 * @returns {Promise<Object>} Resultado da operação.
 */
async function saveProcessStatus(processId, status, details = {}) {
  try {
    const { data: existingData, error: selectError } = await supabase
      .from('process_status')
      .select()
      .eq('process_id', processId)
      .limit(1)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('Erro ao verificar status existente:', selectError.message);
      return { error: selectError };
    }

    let result;
    if (existingData) {
      const { data: updateData, error: updateError } = await supabase
        .from('process_status')
        .update({
          status,
          updated_at: new Date().toISOString(),
          details
        })
        .eq('process_id', processId);
      result = { data: updateData, error: updateError };
    } else {
      const { data: insertData, error: insertError } = await supabase
        .from('process_status')
        .insert({
          process_id: processId,
          status,
          updated_at: new Date().toISOString(),
          details
        });
      result = { data: insertData, error: insertError };
    }

    if (result.error) {
      console.error(`Erro ao atualizar status para ${status}:`, result.error.message);
    }
    return result;
  } catch (error) {
    console.error(`Erro ao salvar status do processo (${status}):`, error.message);
    return { error };
  }
}

/**
 * Salva informações do vídeo gerado no Supabase.
 * @param {Object} videoInfo - Informações do vídeo.
 * @returns {Promise<Object>} Resultado da operação.
 */
async function saveVideoInfo(videoInfo) {
  try {
    console.log('Tentando salvar no Supabase com os dados:', JSON.stringify(videoInfo, null, 2));
    
    const { data, error, status, statusText } = await supabase
      .from('videos')
      .insert(videoInfo)
      .select();
    
    if (error) {
      console.error('Erro ao salvar informações do vídeo no Supabase:', error.message);
      console.error('Detalhes do erro:', JSON.stringify(error, null, 2));
      console.error('Status HTTP:', status, statusText);
      return { error };
    }
    
    console.log('Informações do vídeo salvas no Supabase:', data);
    console.log('Status da operação:', status, statusText);
    return { data };
  } catch (error) {
    console.error('Exceção ao salvar informações do vídeo no Supabase:', error.message);
    console.error('Stack trace:', error.stack);
    return { error };
  }
}

/**
 * Atualiza informações do vídeo no Supabase.
 * @param {string} processId - ID do processo.
 * @param {Object} updateData - Dados a serem atualizados.
 * @returns {Promise<Object>} Resultado da operação.
 */
async function updateVideoInfo(processId, updateData) {
  try {
    console.log('Tentando atualizar no Supabase - Process ID:', processId);
    console.log('Dados de atualização:', JSON.stringify(updateData, null, 2));
    
    const { data, error, status, statusText } = await supabase
      .from('videos')
      .update(updateData)
      .eq('process_id', processId)
      .select();
    
    if (error) {
      console.error('Erro ao atualizar informações do vídeo no Supabase:', error.message);
      console.error('Detalhes do erro:', JSON.stringify(error, null, 2));
      console.error('Status HTTP:', status, statusText);
      return { error };
    }
    
    console.log('Informações do vídeo atualizadas no Supabase:', data);
    console.log('Status da operação:', status, statusText);
    return { data };
  } catch (error) {
    console.error('Exceção ao atualizar informações do vídeo no Supabase:', error.message);
    console.error('Stack trace:', error.stack);
    return { error };
  }
}

module.exports = { saveProcessStatus, saveVideoInfo, updateVideoInfo };
