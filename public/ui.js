import { Pinger } from './lib/pinger.js';
import { Listeners } from './lib/listeners.js';
import { Relays } from './lib/relays.js';
const config = window.hsyncConfig;
const { preact, apiFetch } = config.libs;
const { html, render, useState } = preact;

const styles = {
  main: {
    margin: '15px',
    width: '90%',
  },
};

function App () {
  const [creds, setCreds] = useState(config.creds);
  const [loggingIn, setLoggingIn] = useState(false);
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');

  const textInput = (e) => {
    setSecret(e.target.value);
  };

  const logout = async () => {
    await apiFetch('/logout');
    setCreds(false);
  };

  const auth = async () => {
    setError('');
    setLoggingIn(true);
    try {
      await apiFetch.post('/auth', {secret});
      setCreds(true);
      setLoggingIn(false);
    } catch (e) {
      setLoggingIn(false);
      setError(e);
    }
  };

  return html`
  <div>
  ${creds ? 
    html`
    <div class="navbar navbar-dark bg-dark shadow-sm">
      <div class="container">
        <div class="navbar-brand d-flex align-items-center">
          <strong>${hsyncConfig.hostName}</strong>
        </div>
        <div><button onClick=${logout} class="btn btn-danger">log out</button></div>
      </div>
    </div>
    <main style=${styles.main}>
      <div>${error?.message || error?.toString()}</div>
      <div><${Listeners}/></div>
      <div><${Relays}/></div>
      <div><${Pinger}/></div>
    </main>`
    :
    html`
    <div style=${{margin: '15px'}}>
      <div class="mb-3">
        <input type=password class="form-control" id="exampleFormControlInput1" placeholder="secret" onInput=${textInput} value=${secret} />
      </div>
      <button 
          class="btn btn-primary"
          disabled=${loggingIn}
          onClick=${auth}
        >
          Log in
        </button>
    </div>` 
    }
  </div>
  `;
}

render(html`<${App} />`, document.getElementById('root'));