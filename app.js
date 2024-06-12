const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const chatRoutes = require("./routes/chatRoutes");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let clients = {};
let messages = { all: [] }; // Almacena mensajes para el chat grupal

app.use(express.static(path.join(__dirname, "public")));
app.use("/", chatRoutes);

io.on("connection", (socket) => {
  console.log("Nuevo cliente conectado:", socket.id);

  socket.on("newClient", (data) => {
    socket.username = data.username;
    socket.color = data.color;
    clients[socket.id] = {
      username: data.username,
      color: data.color,
      socketId: socket.id,
      unreadMessages: {},
    };
    messages[socket.username] = []; // Inicializa el almacenamiento de mensajes privados para el nuevo cliente
    io.emit("clientsUpdate", Object.values(clients));
  });

  socket.on("chatMessage", (data) => {
    const { username, message, color, recipient } = data;
    const messageData = {
      username,
      message,
      color,
      recipient,
      sender: username,
    };

    if (recipient === "all") {
      messages.all.push(messageData);
      io.emit("chatMessage", messageData);
    } else {
      if (!messages[recipient]) messages[recipient] = [];
      if (!messages[username]) messages[username] = [];
      messages[recipient].push(messageData);
      messages[username].push(messageData);

      const recipientSocket = Object.values(clients).find(
        (client) => client.username === recipient
      )?.socketId;
      if (recipientSocket) {
        io.to(recipientSocket).emit("chatMessage", messageData);
        // Incrementa el contador de mensajes no leídos
        if (!clients[recipientSocket].unreadMessages[username]) {
          clients[recipientSocket].unreadMessages[username] = 0;
        }
        clients[recipientSocket].unreadMessages[username]++;
        io.to(recipientSocket).emit(
          "updateUnreadMessages",
          clients[recipientSocket].unreadMessages
        );
      }
      // Siempre emite al remitente para mostrar sus propios mensajes enviados
      socket.emit("chatMessage", messageData);
    }
  });

  socket.on("changeChat", (recipient) => {
    if (recipient === "all") {
      socket.emit("loadMessages", messages.all);
    } else {
      const relevantMessages = messages[socket.username].filter(
        (msg) => msg.recipient === recipient || msg.sender === recipient
      );
      socket.emit("loadMessages", relevantMessages);
      // Limpia el contador de mensajes no leídos para este destinatario
      if (clients[socket.id].unreadMessages[recipient]) {
        delete clients[socket.id].unreadMessages[recipient];
        socket.emit("updateUnreadMessages", clients[socket.id].unreadMessages);
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("Cliente desconectado:", socket.id);
    if (clients[socket.id]) {
      const username = clients[socket.id].username;
      delete clients[socket.id]; // Elimina de la lista de clientes
      delete messages[username]; // Elimina los mensajes privados del cliente desconectado
      io.emit("clientsUpdate", Object.values(clients));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`Servidor corriendo en el puerto ${PORT}`)
);
