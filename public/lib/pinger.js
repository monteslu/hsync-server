const config = window.hsyncConfig;
const { preact, apiFetch } = config.libs;
const { html, useState } = preact;

export function Pinger () {
  const [pinging, setPinging] = useState(false);
  const [pingMsg, setPingMsg] = useState('');
  const [pingResult, setPingResult] = useState('');
  const [error, setError] = useState('');

  const pingInput = (e) => {
    setPingMsg(e.target.value);
  };

  const sendPing = async () => {
    setPinging(true);
    setPingResult('');
    setError('');
    try {
      const pingVal = await apiFetch.post('/srpc', {method: 'ping', params: [pingMsg]});
      setPingResult(pingVal);
      setPinging(false);
    } catch (e) {
      setPinging(false);
      setError(e);
    }
  };

  return html`
  <div class="card" style="width: 18rem;">
    <div class="card-body">
      <h5 class="card-title">Client Ping</h5>
      ${pinging ? html`<div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
        </div>` : ''}
      ${error ? html`<div class="alert alert-danger" role="alert">
        ${error?.message || error?.toString()}
      </div>` : ''}
      ${pingResult ? html`<div class="alert alert-success" role="alert">
        ${pingResult}
      </div>` : ''}
      
      <div class="mb-3">
        <input type="text" class="form-control" id="exampleFormControlInput1" placeholder="message" onInput=${pingInput} value=${pingMsg} />
      </div>
      <div class="mdl-card__supporting-text">
        <button 
          class="btn btn-primary"
          disabled=${pinging}
          onClick=${sendPing}
        >
          Send Ping
        </button>
      </div>
    </div>
  </div>

  `;
}