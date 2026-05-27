// Lazy-loaded affiliates feature module
// Handles affiliate link management and configuration

export const initAffiliatesFeature = (globalState, utils) => {
  const { request, byId, escapeHtml } = utils;

  const loadAffiliateLinks = async () => {
    const payload = await request('/api/affiliate-links');
    globalState.affiliateLinks = normalizeAffiliateLinksPayload(payload.affiliateLinks || {});
  };

  const normalizeAffiliateLinksPayload = (payload = {}) => ({
    creditBuilder: Array.isArray(payload.creditBuilder) ? payload.creditBuilder : [],
    creditMonitoring: Array.isArray(payload.creditMonitoring) ? payload.creditMonitoring : [],
  });

  const renderAffiliateBuilderRows = () => globalState.affiliateLinks.creditBuilder.map((row, index) => `
    <article class="affiliate-row-card" data-affiliate-section="creditBuilder" data-affiliate-id="${escapeHtml(row.id)}">
      <div class="affiliate-row-media">
        ${row.imagePath ? `<img class="affiliate-row-image" src="${escapeHtml(row.imagePath)}" alt="${escapeHtml(row.name || 'Affiliate logo')}" />` : '<div class="affiliate-row-image affiliate-row-image-placeholder">Logo</div>'}
        <label class="affiliate-image-upload">
          <input class="affiliate-image-input" type="file" accept="image/*" data-image-section="creditBuilder" data-image-id="${escapeHtml(row.id)}" />
          Upload
        </label>
      </div>
      <div class="affiliate-row-main">
        <label class="field">
          <span>Name</span>
          <input class="affiliate-name-input" data-affiliate-field="name" value="${escapeHtml(row.name)}" placeholder="Boom Pay" />
        </label>
        <label class="field">
          <span>Description</span>
          <input class="affiliate-description-input" data-affiliate-field="description" value="${escapeHtml(row.description)}" placeholder="Build credit with your rent." />
        </label>
        <label class="field">
          <span>Affiliate Link</span>
          <input class="affiliate-url-input" data-affiliate-field="url" value="${escapeHtml(row.url)}" placeholder="https://..." />
        </label>
      </div>
      <div class="affiliate-row-side">
        <div class="affiliate-toggle-stack">
          <label class="affiliate-toggle-line">
            <span>Show</span>
            <input class="affiliate-toggle-input" data-affiliate-field="show" type="checkbox"${row.show ? ' checked' : ''} />
          </label>
          <label class="affiliate-toggle-line">
            <span>Default</span>
            <input class="affiliate-toggle-input" data-affiliate-field="isDefault" type="checkbox"${row.isDefault ? ' checked' : ''} />
          </label>
        </div>
        <button class="affiliate-save-button" type="button" data-save-affiliate="creditBuilder" data-affiliate-id="${escapeHtml(row.id)}">Save</button>
        <span class="affiliate-row-index">#${index + 1}</span>
      </div>
    </article>
  `).join('');

  const bindAffiliateEvents = () => {
    // Event binding is handled in app.js to avoid duplication
    // This method is kept for API compatibility
  };

  const openAffiliateLinksDialog = () => {
    const dialog = byId('affiliateLinksDialog');
    if (dialog) {
      dialog.showModal();
      syncAffiliateTabs();
    }
  };

  const closeAffiliateLinksDialog = () => {
    const dialog = byId('affiliateLinksDialog');
    if (dialog) {
      dialog.close();
    }
  };

  const syncAffiliateTabs = () => {
    const tabs = [...document.querySelectorAll('[data-affiliate-tab-target]')];
    tabs.forEach((button) => {
      const target = button.dataset.affiliateTabTarget || 'creditBuilder';
      const content = byId(target);
      if (content) {
        content.innerHTML = target === 'creditBuilder'
          ? renderAffiliateBuilderRows()
          : renderAffiliateMonitoringRows();
      }
    });
  };

  const renderAffiliateMonitoringRows = () => globalState.affiliateLinks.creditMonitoring.map((row) => `
    <article class="affiliate-row-card affiliate-row-card-monitoring" data-affiliate-section="creditMonitoring" data-affiliate-id="${escapeHtml(row.id)}">
      <div class="affiliate-row-media">
        ${row.imagePath ? `<img class="affiliate-row-image" src="${escapeHtml(row.imagePath)}" alt="${escapeHtml(row.name || 'Affiliate logo')}" />` : '<div class="affiliate-row-image affiliate-row-image-placeholder">Logo</div>'}
      </div>
      <div class="affiliate-row-main">
        <span class="affiliate-launch-pill">${escapeHtml(row.name)} Partner Signup</span>
        <label class="field">
          <span>Affiliate Link</span>
          <input class="affiliate-url-input" data-affiliate-field="url" value="${escapeHtml(row.url)}" placeholder="https://..." />
        </label>
      </div>
      <div class="affiliate-row-side">
        <div class="affiliate-toggle-stack">
          <label class="affiliate-toggle-line">
            <span>Show</span>
            <input class="affiliate-toggle-input" data-affiliate-field="show" type="checkbox"${row.show ? ' checked' : ''} />
          </label>
        </div>
        <button class="affiliate-save-button" type="button" data-save-affiliate="creditMonitoring" data-affiliate-id="${escapeHtml(row.id)}">Save</button>
      </div>
    </article>
  `).join('');

  return {
    loadAffiliateLinks,
    bindAffiliateEvents,
    syncAffiliateTabs,
  };
};
