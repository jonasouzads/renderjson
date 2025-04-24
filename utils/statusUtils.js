const supabase = require('./supabaseClient');

// Função para carregar o status dos processos do Supabase
const loadProcessStatus = async () => {
  try {
    const { data, error } = await supabase
      .from('process_status')
      .select('*');

    if (error) {
      console.error('Erro ao carregar status dos processos do Supabase:', error.message);
      return {};
    }

    // Transformar array de dados em objeto para compatibilidade com código existente
    const statusData = {};
    data.forEach(item => {
      statusData[item.process_id] = {
        status: item.status,
        updatedAt: item.updated_at,
        details: item.details
      };
    });

    return statusData;
  } catch (error) {
    console.error('Erro inesperado ao carregar status dos processos:', error.message);
    return {};
  }
};

// Função para salvar o status de um processo no Supabase
const saveProcessStatus = async (processId, status, details = {}) => {
  try {
    const { data, error } = await supabase
      .from('process_status')
      .upsert([
        {
          process_id: processId,
          status: status,
          updated_at: new Date().toISOString(),
          details: details
        }
      ]);

    if (error) {
      console.error('Erro ao salvar status do processo no Supabase:', error.message);
      throw error;
    }

    console.log(`Status atualizado para processo ${processId}: ${status}`);
    return data;
  } catch (error) {
    console.error('Erro inesperado ao salvar status do processo:', error.message);
    throw error;
  }
};

module.exports = {
  loadProcessStatus,
  saveProcessStatus
};
