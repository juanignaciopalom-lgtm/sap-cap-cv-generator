const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {
  const normalizeText = (s) =>
    (s || "").trim().replace(/\s+/g, " ");

  const normalizeSkillName = (s) =>
    normalizeText(s).toLowerCase();

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
  }

  // ───────────────── ADMIN SERVICE ─────────────────
  if (this.name.endsWith('AdminService')) {

    // Defensa extra en runtime, además de @requires:'CVAdmin'
    this.before('*', (req) => {
      if (!req.user || !req.user.is('CVAdmin')) {
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