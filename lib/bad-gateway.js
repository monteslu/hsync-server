// template for 502 error when a hysnc relay isn't connected

const template = `HTTP/1.1 502 Bad Gateway
X-Powered-By: hysnc-server
Content-Type: text/html

<html>
  <head>
    <style>
      .header {
        color: red;
        text-align: center;
        font-size: 3rem;
      }
      .warning {
        background-color: #EDE1D0;
        border-radius: 3px;
        margin: 1rem;
        padding: 0.5rem;
        font-size: 1.2rem;
      }
      .info {
        background-color: #fDf1e0;
        border-radius: 3px;
        margin: 1rem;
        padding: 0.5rem;
        font-size: 1.2rem;
      }
    </style>
  </head>
  <body>
    <div class="header">He's dead, Jim.</div>
    <div class="warning">
      There's no relay connected to this hysnc-server.
    </div>
    <div class="info">
      Make sure you have <a href="https://github.com/monteslu/hsync">https://github.com/monteslu/hsync</a> running on your local machine.
    </div>
  </body>
</html>
`;

export default template;
