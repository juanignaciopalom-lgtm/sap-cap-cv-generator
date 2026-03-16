# SAP CAP CV Generator

Aplicación portfolio/CV construida con tecnologías SAP.

## Stack

- SAP CAP
- CDS
- OData V4
- SAPUI5
- SAP BTP
- SAPSAP HANA Cloud (Migrado) X
- SAPPostgreSQL

## Qué hace

Permite mostrar un CV/portfolio dinámico con:

- perfil
- skills
- experiencia
- proyectos
- educación
- certificaciones
- idiomas

## Arquitectura

- **Frontend:** SAPUI5
- **Backend:** SAP CAP Node.js
- **Modelo:** CDS
- **Persistencia:** base de datos desacoplada del servicio
- **Exposición:** OData V4

## Estructura del proyecto

```text
app/        frontend UI5
db/         modelo CDS y persistencia
srv/        servicios CAP
