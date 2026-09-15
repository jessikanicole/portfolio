/**
 * PORTAFOLIO — backend de edición
 * ---------------------------------------------------------
 * Este script recibe los cambios del panel "edit" del portafolio
 * y los guarda directo en el archivo data.json de tu repositorio
 * de GitHub, usando la API de GitHub.
 *
 * CONFIGURACIÓN (una sola vez):
 * 1. En este proyecto de Apps Script, ve a Configuración del
 *    proyecto (ícono de engranaje) > Propiedades del script >
 *    Agregar propiedad del script, y crea estas 4:
 *
 *      GITHUB_TOKEN      -> tu Personal Access Token de GitHub
 *                           (ver instrucciones para crearlo)
 *      GITHUB_REPO       -> usuario/nombre-repo
 *                           ej: jessikanicole/portafolio
 *      GITHUB_FILE_PATH  -> data.json
 *      EDIT_PASSWORD     -> la contraseña que vas a usar en el
 *                           panel "edit" del sitio
 *
 * 2. Implementar > Nueva implementación > Tipo: Aplicación web
 *      - Ejecutar como: Yo
 *      - Quién tiene acceso: Cualquier usuario
 *    Copia la URL que te da y pégala en index.html en la
 *    constante WEBAPP_URL.
 * ---------------------------------------------------------
 */

const GITHUB_BRANCH = 'main'; // cambia a "master" si tu repo usa ese nombre

function doPost(e) {
  const props = PropertiesService.getScriptProperties();
  const GITHUB_TOKEN = props.getProperty('GITHUB_TOKEN');
  const GITHUB_REPO = props.getProperty('GITHUB_REPO');
  const GITHUB_FILE_PATH = props.getProperty('GITHUB_FILE_PATH');
  const EDIT_PASSWORD = props.getProperty('EDIT_PASSWORD');

  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return respond({ ok: false, error: 'invalid_request' });
  }

  const action = body.action;

  if (action === 'verify') {
    return respond({ ok: body.password === EDIT_PASSWORD });
  }

  if (action === 'save') {
    if (body.password !== EDIT_PASSWORD) {
      return respond({ ok: false, error: 'wrong_password' });
    }
    try {
      saveToGithub(GITHUB_TOKEN, GITHUB_REPO, GITHUB_FILE_PATH, body.data);
      return respond({ ok: true });
    } catch (err) {
      return respond({ ok: false, error: err.message });
    }
  }

  return respond({ ok: false, error: 'unknown_action' });
}

function saveToGithub(token, repo, filePath, data) {
  const apiUrl = 'https://api.github.com/repos/' + repo + '/contents/' + filePath;

  // 1. Obtener el SHA del archivo actual (GitHub lo exige para poder actualizarlo)
  const getResp = UrlFetchApp.fetch(apiUrl + '?ref=' + GITHUB_BRANCH, {
    method: 'get',
    headers: {
      Authorization: 'token ' + token,
      Accept: 'application/vnd.github+json'
    },
    muteHttpExceptions: true
  });

  if (getResp.getResponseCode() !== 200) {
    throw new Error('No se pudo leer el archivo actual en GitHub: ' + getResp.getContentText());
  }
  const sha = JSON.parse(getResp.getContentText()).sha;

  // 2. Codificar el nuevo contenido en base64 (formato que exige GitHub)
  const jsonString = JSON.stringify(data, null, 2);
  const content = Utilities.base64Encode(jsonString, Utilities.Charset.UTF_8);

  // 3. Subir la actualización
  const payload = {
    message: 'Actualizar portafolio desde el panel de edición',
    content: content,
    sha: sha,
    branch: GITHUB_BRANCH
  };

  const putResp = UrlFetchApp.fetch(apiUrl, {
    method: 'put',
    contentType: 'application/json',
    headers: {
      Authorization: 'token ' + token,
      Accept: 'application/vnd.github+json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const status = putResp.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error('GitHub rechazó el guardado: ' + putResp.getContentText());
  }
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
