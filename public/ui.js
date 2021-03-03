const { h, Component, render } = preact;

// Initialize htm with Preact
const html = htm.bind(h);

function App (props) {
  return html`<h1>Hello ${props.name}!</h1><button onClick=${() =>  console.log('yo')}>hey</button>`;
}

render(html`<${App} name="World" />`, document.getElementById('root'));