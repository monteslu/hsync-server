// template for 400 error for not well formed http

const template = `HTTP/1.1 400 Bad Request 
X-Powered-By: hsync-server
Content-Type: text/plain

no
`;

module.exports = template;
