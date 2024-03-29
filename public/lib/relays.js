const config = window.hsyncConfig;
const { preact, apiFetch, debug } = config.libs;
const { html, useState, useEffect } = preact;

export function Relays () {
  const [updating, setUpdating] = useState(false);
  const [rprResult, setRpcResult] = useState('');
  const [error, setError] = useState('');
  const [relays, setRelays] = useState([]);
  const [port, setPort] = useState(null);
  const [targetPort, setTargetPort] = useState(null);
  const [hostName, setHostName] = useState(null);
  const [whitelist, setWhitelist] = useState(null);
  const [blacklist, setBlacklist] = useState(null);

  const getRelays = async () => {
    const results = await apiFetch.post('/srpc', {method: 'getSocketRelays', params: []});
    debug('results', results);
    setRelays(results);
  }

  useEffect(() => {
    getRelays();
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

  const whitelistInput = (e) => {
    setWhitelist(e.target.value);
  };

  const blacklistInput = (e) => {
    setBlacklist(e.target.value);
  };

  const addRelay = async () => {
    setUpdating(true);
    setRpcResult('');
    setError('');
    try {
      const params = [{
        port,
        targetHost: hostName,
        targetPort,
        whitelist,
        blacklist,
      }];
      const retVal = await apiFetch.post('/srpc', {method: 'addSocketRelay', params});
      await getRelays();
      setRpcResult(retVal);
      setUpdating(false);
    } catch (e) {
      setUpdating(false);
      setError(e);
    }
  };


  return html`
  <div class="card" style="width: 90%; margin: 10px;">
    <div class="card-body" style="width: 90%">
      <h4 class="card-title">RELAYS</h4>
      <h6 class="card-title">Recieve inbound tcp sockets requests and relays to a target host (usually localhost) and port</h6>
      <h6 class="card-title">This is useful for sharing a service that this hsync client has access to.</h6>
      ${updating ? html`<div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
        </div>` : ''}
      ${error ? html`<div class="alert alert-danger" role="alert">
        ${error?.message || error?.toString()}
      </div>` : ''}
      ${rprResult ? html`<div class="alert alert-success" role="alert">
        ${rprResult}
      </div>` : ''}
      ${relays?.length ? html`
        <div style="margin: 10px; border: 1px solid grey; padding: 10px; width: 90%;">
          <table style="width: 90%;">
            <thead>
              <tr border="1">
                <th>inbound port</th>
                <th>target host</th>
                <th>target port</th>
                <th>whitelist</th>
                <th>blacklist</th>
              </tr>
            </thead>
            <tbody>
              ${relays.map((r) => {
                return html`
                  <tr>
                    <td>
                      ${r.port}
                    </td>
                    <td>
                      ${r.hostName}
                    </td>
                    <td>
                      ${r.targetPort}
                    </td>
                    <td>
                      ${r.whitelist}
                    </td>
                    <td>
                      ${r.blacklist}
                    </td>
                  </tr>
                `
              })}
            </tbody>
          </table>
        </div>
      `: ''}
      <div class="mb-3">
        <input type="number" class="form-control" placeholder="inbound hsync port" onInput=${portInput} value=${port} />
        <input type="hostName" class="form-control" placeholder="target host name" onInput=${hostNameInput} value=${hostName} />
        <input type="number" class="form-control" placeholder="target port" onInput=${targetPortInput} value=${targetPort} />
        <input type="text" class="form-control" placeholder="whitelist" onInput=${whitelistInput} value=${whitelist} />
        <input type="text" class="form-control" placeholder="blacklist" onInput=${blacklistInput} value=${blacklist} />
      </div>
      <div class="mdl-card__supporting-text">
        <button 
          class="btn btn-primary"
          disabled=${updating}
          onClick=${addRelay}
        >
          Add Relay
        </button>
      </div>
    </div>
  </div>

  `;
}