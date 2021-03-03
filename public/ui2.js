import { h, Component, render } from 'https://unpkg.com/preact?module';
import htm from 'https://unpkg.com/htm?module';

// Initialize htm with Preact
const html = htm.bind(h);

function App (props) {
  return html`<h1>Hello ${props.name}!</h1>`;
}

render(html`<${App} name="World" />`, document.body);