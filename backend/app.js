import { Server } from "socket.io";

const io = new Server(8080, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join-room", ({ roomId }) => {
    const room = io.sockets.adapter.rooms.get(roomId);
    const usersInRoom = room ? room.size : 0;

    if (usersInRoom >= 2) {
      socket.emit("room-full");
      return;
    }

    socket.join(roomId);
    socket.to(roomId).emit("user-joined", { id: socket.id });
  });

  socket.on("call-user", ({ to, offer }) => {
    io.to(to).emit("call-made", {
      from: socket.id,
      offer,
    });
  });

  socket.on("make-answer", ({ to, answer }) => {
    io.to(to).emit("answer-made", {
      from: socket.id,
      answer,
    });
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    io.to(to).emit("ice-candidate", {
      from: socket.id,
      candidate,
    });
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});
