const config = window.hsyncConfig;
const { preact, apiFetch } = config.libs;
const { html, useState, useEffect } = preact;

export function Listeners () {
  const [updating, setUpdating] = useState(false);
  const [rpcResult, setRpcResult] = useState('');
  const [error, setError] = useState('');
  const [listeners, setListeners] = useState([]);
  const [port, setPort] = useState(null);
  const [targetPort, setTargetPort] = useState(null);
  const [hostName, setHostName] = useState(null);

  useEffect(() => {
    const getListeners = async () => {
      const results = await apiFetch.post('/srpc', {method: 'getSocketListeners', params: []});
      console.log('results', results);
      setListeners(results);
    }
    getListeners();
  }, [])

  const portInput = (e) => {
    setPort(e.target.value);
  };

  const targetPortInput = (e) => {
    setTargetPort(e.target.value);
  };

  const hostNameInput = (e) => {
    setHostName(e.target.value);
  };

  const addListener = async () => {
    setUpdating(true);
    setRpcResult('');
    setError('');
    try {
      const pingVal = await apiFetch.post('/srpc', {method: 'addSocketListener', params: [port, hostName, targetPort]});
      setRpcResult(pingVal);
      setUpdating(false);
    } catch (e) {
      setUpdating(false);
      setError(e);
    }
  };

  return html`
  <div class="card" style="width: 90%; margin: 10px;">
    <div class="card-body" style="width: 90%">
      <h4 class="card-title">LISTENERS</h4>
      <h6 class="card-title">Open a local TCP port and sends socket requests to a target hsync client and port</h6>
      ${updating ? html`<div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
        </div>` : ''}
      ${error ? html`<div class="alert alert-danger" role="alert">
        ${error?.message || error?.toString()}
      </div>` : ''}
      ${rpcResult ? html`<div class="alert alert-success" role="alert">
        ${rpcResult}
      </div>` : ''}
      ${listeners?.length ? html`
        <div style="margin: 10px; border: 1px solid grey; padding: 10px; width: 90%;">
          <table style="width: 90%;">
            <thead>
              <tr border="1">
                <th>port</th><th>host</th><th>target port</th>
              </tr>
            </thead>
            <tbody>
              ${listeners.map((r) => {
                return html`
                  <tr>
                    <td>
                      ${r.info.port}
                    </td>
                    <td>
                      ${r.info.hostName}
                    </td>
                    <td>
                      ${r.info.targetPort}
                    </td>
                  </tr>
                `
              })}
            </tbody>
          </table>
        </div>
      `: ''}
      <div class="mb-3">
        <input type="number" class="form-control" placeholder="port" onInput=${portInput} value=${port} />
        <input type="hostName" class="form-control" placeholder="taget hsync host" onInput=${hostNameInput} value=${hostName} />
        <input type="number" class="form-control" placeholder="target port" onInput=${targetPortInput} value=${targetPort} />
      </div>
      <div class="mdl-card__supporting-text">
        <button 
          class="btn btn-primary"
          disabled=${updating}
          onClick=${addListener}
        >
          Add Listener
        </button>
      </div>
    </div>
  </div>

  `;
}