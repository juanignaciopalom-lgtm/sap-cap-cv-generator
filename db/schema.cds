namespace cv.app;

using { cuid, managed } from '@sap/cds/common';

// ─── Perfil principal ───────────────────────────────────────────
entity Profile : cuid {
    firstName       : String(100);
    lastName        : String(100);
    title           : String(150);  // Ej: "SAP ABAP Developer"
    summary         : LargeString;  // Párrafo de presentación
    email           : String(150);
    phone           : String(50);
    location        : String(150);  // Ej: "Buenos Aires, Argentina"
    linkedinUrl     : String(300);
    githubUrl       : String(300);
    photoUrl        : String(500);
    skills          : Composition of many Skills on skills.profile = $self;
    experiences     : Composition of many Experiences on experiences.profile = $self;
    projects        : Composition of many Projects on projects.profile = $self;
    education       : Composition of many Education on education.profile = $self;
    certifications  : Composition of many Certifications on certifications.profile = $self;
    languages       : Composition of many Languages on languages.profile = $self;
}

// ─── Skills ─────────────────────────────────────────────────────
entity Skills : cuid {
    profile     : Association to Profile;
    name        : String(100);  // Ej: "ABAP", "CAP", "Fiori"
    category    : String(100);  // Ej: "Backend", "Frontend", "SAP"
    level       : Integer;      // 1 a 5
}

// ─── Experiencia laboral ─────────────────────────────────────────
entity Experiences : cuid {
    profile         : Association to Profile;
    company         : String(150);
    role            : String(150);
    location        : String(150);
    startDate       : Date;
    endDate         : Date;        // null = trabajo actual
    current         : Boolean default false;
    description     : LargeString;
    technologies    : String(500); // Ej: "ABAP, BTP, CAP, Fiori"
}

// ─── Proyectos ───────────────────────────────────────────────────
entity Projects : cuid {
    profile         : Association to Profile;
    name            : String(150);
    description     : LargeString;
    technologies    : String(500);
    projectUrl      : String(300);
    imageUrl        : String(500);
}

// ─── Educación ───────────────────────────────────────────────────
entity Education : cuid {
    profile         : Association to Profile;
    institution     : String(150);
    degree          : String(150);
    fieldOfStudy    : String(150);
    startYear       : Integer;
    endYear         : Integer;
}

// ─── Certificaciones ─────────────────────────────────────────────
entity Certifications : cuid {
    profile         : Association to Profile;
    name            : String(200);
    issuingOrg      : String(150);
    issueYear       : Integer;
    credentialUrl   : String(300);
}

// ─── Idiomas ─────────────────────────────────────────────────────
entity Languages : cuid {
    profile         : Association to Profile;
    language        : String(100);  // Ej: "Español"
    proficiency     : String(50);   // Ej: "Nativo", "Avanzado", "Intermedio"
}