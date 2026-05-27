// Lazy-loaded integrations feature module
// Handles SmartCredit, MyFreeScoreNow, and other integrations

export const initIntegrationsFeature = (globalState, utils) => {
  const { request, byId, setIntegrationMessage, applyIntegrationValues, syncSmartCreditClientTokenInput, renderClientDetail } = utils;

  const loadIntegrations = async () => {
    const payload = await request('/api/integrations');
    globalState.integrations = payload.integrations || globalState.integrations;
    const smartCreditDefault = globalState.integrations.smartcredit35540
      || globalState.integrations.smartcredit
      || { tokenId: '', apiSecret: '' };
    applyIntegrationValues('smartCreditIntegrationForm', smartCreditDefault);
    syncSmartCreditClientTokenInput();
    if (globalState.selectedClientId) {
      const selectedClient = globalState.clients.find((client) => client.id === globalState.selectedClientId);
      if (selectedClient) {
        renderClientDetail(selectedClient);
      }
    }
  };

  const bindIntegrationEvents = () => {
    byId('smartCreditIntegrationForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      setIntegrationMessage('');

      try {
        const form = event.currentTarget;
        const payload = await request('/api/integrations/smartcredit', {
          method: 'PUT',
          body: JSON.stringify({
            tokenId: form.tokenId.value,
            apiSecret: form.apiSecret.value,
          }),
        });
        globalState.integrations.smartcredit = payload.integration;
        applyIntegrationValues('smartCreditIntegrationForm', payload.integration);
        setIntegrationMessage('SmartCredit integration saved.');
      } catch (error) {
        setIntegrationMessage(error.message, true);
      }
    });

    byId('myFreeScoreIntegrationForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      setIntegrationMessage('');

      try {
        const form = event.currentTarget;
        const payload = await request('/api/integrations/myfreescorenow', {
          method: 'PUT',
          body: JSON.stringify({
            pid: form.pid?.value || '',
            tokenId: form.tokenId.value,
            apiSecret: form.apiSecret.value,
          }),
        });
        globalState.integrations.myfreescorenow = payload.integration;
        applyIntegrationValues('myFreeScoreIntegrationForm', payload.integration);
        setIntegrationMessage('MyFreeScoreNow integration saved.');
      } catch (error) {
        setIntegrationMessage(error.message, true);
      }
    });
  };

  return {
    loadIntegrations,
    bindIntegrationEvents,
  };
};
