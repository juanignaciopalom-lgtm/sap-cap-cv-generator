const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {
  const { SELECT, INSERT, UPDATE } = cds.ql;

  const LEAD_STATUS = {
    NEW: 'NEW',
    BPA_TRIGGERED: 'BPA_TRIGGERED',
    BPA_FAILED: 'BPA_FAILED',
    CONTACTED: 'CONTACTED',
    DISCARDED: 'DISCARDED'
  };

  const normalizeText = (sValue) =>
    (sValue || '').trim().replace(/\s+/g, ' ');

  const normalizeSkillName = (sValue) =>
    normalizeText(sValue).toLowerCase();

  const isValidEmail = (sEmail) => {
    const sValue = normalizeText(sEmail);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sValue);
  };

  async function getCurrentProfileID(tx) {
    const oProfile = await tx.run(
      SELECT.one.from('cv.app.Profile').columns('ID')
    );
    return oProfile && oProfile.ID;
  }

  function buildLeadPayload(oLead) {
    return {
      leadid: oLead.ID,
      fullname: oLead.fullName,
      email: oLead.email,
      company: oLead.company,
      phone: oLead.phone,
      role: oLead.role,
      message: oLead.message,
      source: oLead.source,
      createdat: oLead.createdAt
    };
  }

  async function updateLeadStatus(tx, ID, oData) {
    await tx.run(
      UPDATE('cv.app.RecruiterLeads')
        .set(oData)
        .where({ ID })
    );
  }

  function buildLeadActionResult(success, message) {
    return { success, message };
  }

  async function getBpaAccessToken() {
    const BPA_TOKEN_URL = process.env.BPA_TOKEN_URL;
    const BPA_CLIENT_ID = process.env.BPA_CLIENT_ID;
    const BPA_CLIENT_SECRET = process.env.BPA_CLIENT_SECRET;

    if (!BPA_TOKEN_URL) {
      throw new Error('Falta definir BPA_TOKEN_URL.');
    }

    if (!BPA_CLIENT_ID) {
      throw new Error('Falta definir BPA_CLIENT_ID.');
    }

    if (!BPA_CLIENT_SECRET) {
      throw new Error('Falta definir BPA_CLIENT_SECRET.');
    }

    const sBasicAuth = Buffer
      .from(`${BPA_CLIENT_ID}:${BPA_CLIENT_SECRET}`)
      .toString('base64');

    const oTokenResponse = await fetch(BPA_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${sBasicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    const sRaw = await oTokenResponse.text();
    let oTokenBody = null;

    try {
      oTokenBody = sRaw ? JSON.parse(sRaw) : null;
    } catch (e) {
      oTokenBody = null;
    }

    console.log('BPA token URL:', BPA_TOKEN_URL);
    console.log('BPA client ID:', BPA_CLIENT_ID);
    console.log('BPA token response status:', oTokenResponse.status);
    console.log('BPA token raw response:', sRaw);

    if (!oTokenResponse.ok) {
      throw new Error(
        oTokenBody?.error_description ||
        oTokenBody?.error ||
        sRaw ||
        `Error obteniendo token OAuth (${oTokenResponse.status})`
      );
    }

    if (!oTokenBody?.access_token) {
      throw new Error('No se recibió access_token desde OAuth.');
    }

    return oTokenBody.access_token;
  }

  async function callBpaTriggerApi(oPayload) {
    const BPA_TRIGGER_URL = process.env.BPA_TRIGGER_URL;
    const BPA_DEFINITION_ID = process.env.BPA_DEFINITION_ID;

    if (!BPA_TRIGGER_URL) {
      return {
        success: false,
        instanceId: null,
        errorMessage: 'Falta definir BPA_TRIGGER_URL.'
      };
    }

    if (!BPA_DEFINITION_ID) {
      return {
        success: false,
        instanceId: null,
        errorMessage: 'Falta definir BPA_DEFINITION_ID.'
      };
    }

    const oRequestBody = {
      definitionId: BPA_DEFINITION_ID,
      context: {
        leadid: oPayload.leadid || null,
        fullname: oPayload.fullname || null,
        email: oPayload.email || null,
        company: oPayload.company || null,
        phone: oPayload.phone || null,
        role: oPayload.role || null,
        message: oPayload.message || null,
        source: oPayload.source || null,
        createdat: oPayload.createdat || null
      }
    };

    console.log('=== BPA START ===');
    console.log('BPA trigger URL:', BPA_TRIGGER_URL);
    console.log('BPA definition ID:', BPA_DEFINITION_ID);
    console.log('BPA request body:', JSON.stringify(oRequestBody, null, 2));

    try {
      const sAccessToken = await getBpaAccessToken();
      console.log('BPA OAuth token obtained:', !!sAccessToken);

      const oResponse = await fetch(BPA_TRIGGER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sAccessToken}`
        },
        body: JSON.stringify(oRequestBody)
      });

      const sRaw = await oResponse.text();
      let oResponseBody = null;

      try {
        oResponseBody = sRaw ? JSON.parse(sRaw) : null;
      } catch (e) {
        oResponseBody = null;
      }

      console.log('BPA response status:', oResponse.status);
      console.log('BPA raw response:', sRaw);
      console.log('=== BPA END ===');

      if (!oResponse.ok) {
        return {
          success: false,
          instanceId: null,
          errorMessage:
            oResponseBody?.error?.message ||
            oResponseBody?.message ||
            sRaw ||
            `HTTP ${oResponse.status}`
        };
      }

      return {
        success: true,
        instanceId: oResponseBody?.id || null,
        errorMessage: null
      };
    } catch (e) {
      console.log('BPA exception:', e);
      console.log('=== BPA END ===');

      return {
        success: false,
        instanceId: null,
        errorMessage: e.message || 'Error inesperado llamando a BPA.'
      };
    }
  }

  async function triggerBpaForLead(oLead) {
    const oPayload = buildLeadPayload(oLead);
    return callBpaTriggerApi(oPayload);
  }

  async function executeLeadBpaTrigger(tx, oLead) {
    const sLeadID = oLead.ID;

    try {
      const oBpaResult = await triggerBpaForLead(oLead);

      if (oBpaResult.success) {
        await updateLeadStatus(tx, sLeadID, {
          status: LEAD_STATUS.BPA_TRIGGERED,
          bpaInstanceId: oBpaResult.instanceId || null,
          bpaErrorMessage: null,
          lastTriggeredAt: new Date().toISOString()
        });

        return buildLeadActionResult(true, 'BPA disparado correctamente.');
      }

      await updateLeadStatus(tx, sLeadID, {
        status: LEAD_STATUS.BPA_FAILED,
        bpaInstanceId: null,
        bpaErrorMessage: oBpaResult.errorMessage || 'Error desconocido al disparar BPA.',
        lastTriggeredAt: new Date().toISOString()
      });

      return buildLeadActionResult(false, 'El disparo de BPA falló.');
    } catch (e) {
      await updateLeadStatus(tx, sLeadID, {
        status: LEAD_STATUS.BPA_FAILED,
        bpaInstanceId: null,
        bpaErrorMessage: e.message || 'Error inesperado al disparar BPA.',
        lastTriggeredAt: new Date().toISOString()
      });

      return buildLeadActionResult(false, 'El disparo de BPA falló.');
    }
  }

  async function getLeadOrReject(tx, req, ID) {
    if (!ID) {
      req.reject(400, 'El ID del lead es obligatorio.');
    }

    const oLead = await tx.run(
      SELECT.one.from('cv.app.RecruiterLeads').where({ ID })
    );

    if (!oLead) {
      req.reject(404, 'Lead no encontrado.');
    }

    return oLead;
  }

  if (this.name.endsWith('PublicService')) {
    const mEntities = {
      Skills: 'cv.app.Skills',
      Experiences: 'cv.app.Experiences',
      Projects: 'cv.app.Projects',
      Education: 'cv.app.Education',
      Certifications: 'cv.app.Certifications',
      Languages: 'cv.app.Languages'
    };

    Object.entries(mEntities).forEach(([sEntity, sSource]) => {
      this.on('READ', sEntity, async (req) => {
        const tx = cds.tx(req);
        const sProfileID = await getCurrentProfileID(tx);

        if (!sProfileID) {
          return [];
        }

        return tx.run(
          SELECT.from(sSource).where({ profile_ID: sProfileID })
        );
      });
    });

    this.on('submitRecruiterLead', async (req) => {
      const tx = cds.tx(req);
      const oData = req.data || {};

      const fullName = normalizeText(oData.fullName);
      const email = normalizeText(oData.email).toLowerCase();
      const company = normalizeText(oData.company);
      const phone = normalizeText(oData.phone);
      const role = normalizeText(oData.role);
      const message = normalizeText(oData.message);
      const source = normalizeText(oData.source) || 'CV_APP';
      const consentAccepted = Boolean(oData.consentAccepted);

      if (!fullName) {
        req.reject(400, 'El nombre y apellido es obligatorio.');
      }

      if (!email) {
        req.reject(400, 'El email es obligatorio.');
      }

      if (!isValidEmail(email)) {
        req.reject(400, 'El email informado no es válido.');
      }

      if (!company) {
        req.reject(400, 'La empresa es obligatoria.');
      }

      if (!consentAccepted) {
        req.reject(400, 'Debés aceptar el consentimiento para ser contactado.');
      }

      const oExistingLead = await tx.run(
        SELECT.one.from('cv.app.RecruiterLeads').where({
          email,
          company
        })
      );

      if (oExistingLead) {
        return buildLeadActionResult(true, 'Ya tenía registrados tus datos para esta empresa.');
      }

      const sLeadID = cds.utils.uuid();

      const oInsertedLead = {
        ID: sLeadID,
        fullName,
        email,
        company,
        phone: phone || null,
        role: role || null,
        message: message || null,
        consentAccepted: true,
        source,
        status: LEAD_STATUS.NEW,
        bpaInstanceId: null,
        bpaErrorMessage: null,
        lastTriggeredAt: null
      };

      await tx.run(
        INSERT.into('cv.app.RecruiterLeads').entries(oInsertedLead)
      );

      const oSavedLead = await tx.run(
        SELECT.one.from('cv.app.RecruiterLeads').where({ ID: sLeadID })
      );

      if (oSavedLead) {
        await executeLeadBpaTrigger(tx, oSavedLead);
      }

      return buildLeadActionResult(true, 'Tus datos fueron registrados correctamente.');
    });
  }

  if (this.name.endsWith('AdminService')) {
    this.before('*', (req) => {
      if (!req.user || !req.user.is('admin')) {
        req.reject(403, 'No autorizado para acceder al panel de administración.');
      }
    });

    this.before(['CREATE', 'UPDATE'], 'Skills', async (req) => {
      const tx = cds.tx(req);
      const oData = req.data || {};

      if (typeof oData.name === 'string') {
        oData.name = normalizeText(oData.name);
      }

      if (typeof oData.category === 'string') {
        oData.category = normalizeText(oData.category);
      }

      const sProfileID = oData.profile_ID || (oData.profile && oData.profile.ID);

      if (!sProfileID || !oData.name) {
        return;
      }

      const aSkills = await tx.run(
        SELECT.from('cv.app.Skills').where({ profile_ID: sProfileID })
      );

      const sNormalizedIncoming = normalizeSkillName(oData.name);

      const oDuplicate = aSkills.find((oSkill) =>
        normalizeSkillName(oSkill.name) === sNormalizedIncoming &&
        oSkill.ID !== oData.ID
      );

      if (oDuplicate) {
        req.reject(400, `La skill "${oData.name}" ya existe para este perfil.`);
      }
    });

    this.on('triggerLeadBpa', async (req) => {
      const tx = cds.tx(req);
      const { ID } = req.data || {};

      const oLead = await getLeadOrReject(tx, req, ID);
      const oResult = await executeLeadBpaTrigger(tx, oLead);

      if (oResult.success) {
        return buildLeadActionResult(true, 'BPA disparado correctamente.');
      }

      return buildLeadActionResult(true, 'El disparo de BPA falló.');
    });

    this.on('markLeadAsContacted', async (req) => {
      const tx = cds.tx(req);
      const { ID } = req.data || {};

      await getLeadOrReject(tx, req, ID);

      await updateLeadStatus(tx, ID, {
        status: LEAD_STATUS.CONTACTED
      });

      return buildLeadActionResult(true, 'Lead marcado como contactado.');
    });

    this.on('discardLead', async (req) => {
      const tx = cds.tx(req);
      const { ID } = req.data || {};

      await getLeadOrReject(tx, req, ID);

      await updateLeadStatus(tx, ID, {
        status: LEAD_STATUS.DISCARDED
      });

      return buildLeadActionResult(true, 'Lead descartado.');
    });

    this.on('retryLeadBpa', async (req) => {
      const tx = cds.tx(req);
      const { ID } = req.data || {};

      const oLead = await getLeadOrReject(tx, req, ID);
      const oResult = await executeLeadBpaTrigger(tx, oLead);

      if (oResult.success) {
        return buildLeadActionResult(true, 'BPA reintentado correctamente.');
      }

      return buildLeadActionResult(true, 'El reintento de BPA falló.');
    });
  }
});