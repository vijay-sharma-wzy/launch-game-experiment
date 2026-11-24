// The only way the client talks to the (simulated) server. Every message crosses as
// JSON, exactly as it would over a network, so the client can never reach server
// objects (answers, roles, acceptance state) by reference. When the server moves to
// AWS, this becomes a WebSocket and nothing on either side changes.
export function connect(server) {
  const wire = (value) => (value === undefined || value === null ? null : JSON.parse(JSON.stringify(value)))
  return { send: (type, data) => wire(server.handle(type, wire(data))) }
}
