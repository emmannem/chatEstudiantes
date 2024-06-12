$(document).ready(function () {
  let socket;
  let username;
  let userColor;
  let currentRecipient = "all"; // 'all' indicates public chat
  const clientsMap = {}; // To store username to socket.id mapping

  $("#login-form").submit(function (e) {
    e.preventDefault();
    username = $("#username").val().trim();
    const email = $("#email").val().trim();

    if (username && validateEmail(email)) {
      userColor = getFreshColor();
      $("#login-container").hide();
      $("#chat-app").show();

      // Cargar el script de socket.io dinámicamente
      $.getScript("/socket.io/socket.io.js", function () {
        // Establecer la conexión después de cargar el script
        socket = io();

        // Asociar el usuario con el id del socket
        socket.emit("newClient", { username, color: userColor });

        // Manejar eventos de socket
        socket.on("chatMessage", function (data) {
          const {
            username: senderUsername,
            message,
            color,
            recipient,
            sender,
          } = data;
          const currentTime = new Date().toLocaleString("en-US", {
            hour: "numeric",
            minute: "numeric",
            hour12: true,
          });
          if (isChatActive(recipient, sender)) {
            // Mostrar el mensaje directamente si el chat está activo
            const div = $("<div>").addClass("message");
            const avatarUrl = `https://robohash.org/${senderUsername}.png?size=50x50`; // Usar RoboHash para generar avatares
            const avatarImg = $("<img>")
              .addClass("avatar")
              .attr("src", avatarUrl);
            const contentDiv = $("<div>").addClass("content");
            const usernameDiv = $("<div>")
              .addClass("username")
              .text(senderUsername)
              .css("color", color);
            const messageDiv = $("<div>").addClass("text").text(message);
            const timeDiv = $("<div>").addClass("time").text(currentTime);

            if (senderUsername === username) {
              div.addClass("right");
            }

            contentDiv.append(usernameDiv).append(messageDiv).append(timeDiv);
            div.append(avatarImg).append(contentDiv);
            $("#messages").append(div);
            $("#messages").scrollTop($("#messages")[0].scrollHeight);
          } else {
            // Incrementar el contador de mensajes no leídos si el chat no está activo
            const recipientName =
              recipient === "all" ? "Group Chat" : recipient;
            const clientElement = $(
              `#clients li[data-username="${recipientName}"]`
            );
            if (clientElement.length) {
              const unreadIndicator = clientElement.find(".unread-count");
              if (unreadIndicator.length) {
                unreadIndicator.text(parseInt(unreadIndicator.text()) + 1);
              } else {
                const newUnreadIndicator = $("<span>")
                  .addClass("unread-count")
                  .text(1);
                clientElement.append(newUnreadIndicator);
              }
            }
          }
        });

        socket.on("clientsUpdate", function (clients) {
          $("#clients").empty();
          $("#clients").append(
            '<li id="group-chat" class="selected" data-username="Group Chat">Group Chat</li>'
          ); // Add group chat option
          $("#group-chat").click(function () {
            currentRecipient = "all";
            $("#clients li").removeClass("selected");
            $(this).addClass("selected");
            socket.emit("changeChat", "all");
            // Clear unread messages count for group chat
            $(this).find(".unread-count").remove();
          });

          clients.forEach((client) => {
            if (client.username !== username) {
              // No incluir el propio nombre de usuario en la lista de clientes
              const avatarUrl = `https://robohash.org/${client.username}.png?size=40x40`; // Usar RoboHash para generar avatares
              const clientElement = $("<li>")
                .attr("data-username", client.username)
                .html(
                  `<img src="${avatarUrl}" class="avatar"> ${client.username}`
                ); // Añadir el avatar
              clientElement.click(function () {
                currentRecipient = client.username;
                $("#clients li").removeClass("selected");
                $(this).addClass("selected");
                socket.emit("changeChat", client.username);
                // Clear unread messages count for this recipient
                $(this).find(".unread-count").remove();
              });
              $("#clients").append(clientElement);
            }
          });
        });

        socket.on("loadMessages", function (messages) {
          $("#messages").empty();
          messages.forEach((message) => {
            const { username: senderUsername, message: text, color } = message;
            const currentTime = new Date().toLocaleString("en-US", {
              hour: "numeric",
              minute: "numeric",
              hour12: true,
            });
            const div = $("<div>").addClass("message");
            const avatarUrl = `https://robohash.org/${senderUsername}.png?size=50x50`; // Usar RoboHash para generar avatares
            const avatarImg = $("<img>")
              .addClass("avatar")
              .attr("src", avatarUrl);
            const contentDiv = $("<div>").addClass("content");
            const usernameDiv = $("<div>")
              .addClass("username")
              .text(senderUsername)
              .css("color", color);
            const messageDiv = $("<div>").addClass("text").text(text);
            const timeDiv = $("<div>").addClass("time").text(currentTime);

            if (senderUsername === username) {
              div.addClass("right");
            }

            contentDiv.append(usernameDiv).append(messageDiv).append(timeDiv);
            div.append(avatarImg).append(contentDiv);
            $("#messages").append(div);
          });
          $("#messages").scrollTop($("#messages")[0].scrollHeight);
        });

        socket.on("updateUnreadMessages", function (unreadMessages) {
          // Clear all indicators
          $("#clients li").each(function () {
            $(this).find(".unread-count").remove();
          });
          // Set new indicators
          for (const [sender, count] of Object.entries(unreadMessages)) {
            const clientElement = $(`#clients li[data-username="${sender}"]`);
            if (clientElement.length) {
              const unreadIndicator = $("<span>")
                .addClass("unread-count")
                .text(count);
              clientElement.append(unreadIndicator);
            }
          }
        });
      });
    } else {
      alert("Please enter a valid username and email.");
    }
  });

  // Enviar mensaje al hacer clic en el botón de enviar
  $("#send-button").click(function () {
    sendMessage();
  });

  // Enviar mensaje al presionar Enter en el campo de entrada
  $("#message-input").keydown(function (e) {
    if (e.key === "Enter") {
      e.preventDefault(); // Prevenir la recarga de la página
      sendMessage();
    }
  });

  function sendMessage() {
    const message = $("#message-input").val().trim();
    if (message) {
      socket.emit("chatMessage", {
        username,
        message,
        color: userColor,
        recipient: currentRecipient,
      });
      $("#message-input").val("");
    }
  }

  function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  function getFreshColor() {
    const colors = [
      "#4CAF50",
      "#FF9800",
      "#2196F3",
      "#FF5722",
      "#9C27B0",
      "#673AB7",
      "#3F51B5",
      "#03A9F4",
      "#00BCD4",
      "#009688",
      "#8BC34A",
      "#CDDC39",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  function isChatActive(recipient, sender) {
    // Verifica si el chat activo coincide con el destinatario del mensaje
    return (
      (recipient === "all" && currentRecipient === "all") ||
      (recipient === currentRecipient && sender === username) ||
      (recipient === username && sender === currentRecipient)
    );
  }
});
