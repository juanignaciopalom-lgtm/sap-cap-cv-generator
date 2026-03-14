using cv.app as db from '../db/schema';

// ─── Servicio público (Viewer - sin autenticación) ───────────────
@path: '/api/public'
@requires: 'any'
service PublicService {

    @readonly
    entity Profile          as projection on db.Profile;
    @readonly
    entity Skills           as projection on db.Skills;
    @readonly
    entity Experiences      as projection on db.Experiences;
    @readonly
    entity Projects         as projection on db.Projects;
    @readonly
    entity Education        as projection on db.Education;
    @readonly
    entity Certifications   as projection on db.Certifications;
    @readonly
    entity Languages        as projection on db.Languages;
}

// ─── Servicio privado (Editor - requiere autenticación) ──────────
@path: '/api/admin'
@requires: 'any' // Provisorio para desarrollo, luego 'authenticated-user'
service AdminService {

    entity Profile          as projection on db.Profile;
    entity Skills           as projection on db.Skills;
    entity Experiences      as projection on db.Experiences;
    entity Projects         as projection on db.Projects;
    entity Education        as projection on db.Education;
    entity Certifications   as projection on db.Certifications;
    entity Languages        as projection on db.Languages;
}