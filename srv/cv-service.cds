using cv.app as db from '../db/schema';

// ─── Servicio público (Viewer) ──────────────────────────────────
@path: '/api/public'
@requires: 'any'
service PublicService {

    @readonly
    entity Profile        as projection on db.Profile;

    @readonly
    entity Skills         as projection on db.Skills;

    @readonly
    entity Experiences    as projection on db.Experiences;

    @readonly
    entity Projects       as projection on db.Projects;

    @readonly
    entity Education      as projection on db.Education;

    @readonly
    entity Certifications as projection on db.Certifications;

    @readonly
    entity Languages      as projection on db.Languages;

    action submitRecruiterLead(
        fullName        : String(150),
        email           : String(150),
        company         : String(150),
        phone           : String(50),
        role            : String(100),
        message         : String,
        consentAccepted : Boolean,
        source          : String(100)
    ) returns {
        success : Boolean;
        message : String;
    };
}

// ─── Servicio privado (Editor) ──────────────────────────────────
@path: '/api/admin'
@requires: 'admin'
service AdminService {

    entity Profile        as projection on db.Profile;
    entity Skills         as projection on db.Skills;
    entity Experiences    as projection on db.Experiences;
    entity Projects       as projection on db.Projects;
    entity Education      as projection on db.Education;
    entity Certifications as projection on db.Certifications;
    entity Languages      as projection on db.Languages;
}