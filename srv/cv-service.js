const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {
  const normalizeText = (s) =>
    (s || "").trim().replace(/\s+/g, " ");

  const normalizeSkillName = (s) =>
    normalizeText(s).toLowerCase();

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

  // ───────────────── PUBLIC SERVICE ─────────────────
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

      await tx.run(
        INSERT.into('cv.app.RecruiterLeads').entries({
          fullName,
          email,
          company,
          phone: phone || null,
          role: role || null,
          message: message || null,
          consentAccepted: true,
          source,
          status: 'NEW',
          bpaInstanceId: null,
          bpaErrorMessage: null
        })
      );

      return {
        success: true,
        message: 'Tus datos fueron registrados correctamente.'
      };
    });
  }

  // ───────────────── ADMIN SERVICE ─────────────────
  if (this.name.endsWith('AdminService')) {

    // Defensa extra en runtime, además de @requires:'admin'
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
  }
});