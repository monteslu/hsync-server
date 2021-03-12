const config = window.hsyncConfig;
const { preact, apiFetch } = config.libs;
const { html, useState, useEffect } = preact;

export function Listeners () {
  const [updating, setUpdating] = useState(false);
  const [pingResult, setPingResult] = useState('');
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
  }, [listeners.length])

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
    setPingResult('');
    setError('');
    try {
      const pingVal = await apiFetch.post('/srpc', {method: 'addSocketListener', params: [port, hostName, targetPort]});
      setPingResult(pingVal);
      setUpdating(false);
    } catch (e) {
      setUpdating(false);
      setError(e);
    }
  };

  console.log('pingr', listeners)

  return html`
  <div class="card" style="width: 18rem;">
    <div class="card-body">
      <h5 class="card-title">Listeners</h5>
      ${updating ? html`<div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
        </div>` : ''}
      ${error ? html`<div class="alert alert-danger" role="alert">
        ${error?.message || error?.toString()}
      </div>` : ''}
      ${pingResult ? html`<div class="alert alert-success" role="alert">
        ${pingResult}
      </div>` : ''}
      
      <div class="mb-3">
        <input type="number" class="form-control" placeholder="port" onInput=${portInput} value=${port} />
        <input type="hostName" class="form-control" placeholder="hostName" onInput=${hostNameInput} value=${hostName} />
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