
function getContent(res) {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.startsWith('application/json')) {
    return res.json();
  }
  if (contentType.startsWith('text')) {
    return res.text();
  }
  return res.blob();
}

export function handledFetch(path, options) {
  return fetch(path, options)
    .then((res) => {
      if (res.status >= 400) {
        const err = new Error('Bad response from server');
        err.status = res.status;
        return getContent(res)
          .then((content) => {
            err.content = content;
            if (content && content.message) {
              err.message = content.message;
            }
            throw err;
          });
      }
      return res;
    });
}

export default function apiFetch(path, options = {}) {
  let qs = '';
  if (typeof options.body === 'object') {
    options.body = JSON.stringify(options.body);
  }
  if (options.query) {
    if (Object.keys(options.query).length) {
      qs = `?${(new URLSearchParams(query)).toString()}`;
    }
  }
  Object.assign(options, { credentials: 'include' });
  options.headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  return handledFetch(`/${window.hsyncConfig.base}${path}${qs}`, options)
    .then(getContent);
}

apiFetch.post = (url, body) => {
  return apiFetch(url, { method: 'POST', body });
}


