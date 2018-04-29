class Client {
  constructor(server, request, result) {
    this.request = request;
    this.result = result;
    this.seq = server.next_seq++;
  }

  process() {
    console.log(`Processing client ${this.seq}`)
  }


}


module.exports = Client;
