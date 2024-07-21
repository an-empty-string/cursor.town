var ageSteps = 100;
var ageRate = 150;
var cursorColor = "black";
var colors = ["black", "red", "green", "blue"];

var cursors = [];
var clientCursors = {};
var otherClientsCount = 0;

var socket = new WebSocket("ws://localhost:8765");
socket.addEventListener("message", (event) => {
    var msg = JSON.parse(event.data);
    if(msg[0] == "create") {
        msg[1].forEach((c) => {
            createCursor(c.x, c.y, c.color, c.age, false);
        });
    }
    else if(msg[0] == "connect") {
        createClientCursor(msg[1]);
    }
    else if(msg[0] == "disconnect") {
        removeClientCursor(msg[1]);
    }
    else if(msg[0] == "color") {
        setClientCursorColor(msg[1].id, msg[1].color);
    }
    else if(msg[0] == "position") {
        console.log(msg[1]);
        moveClientCursor(msg[1].id, msg[1].x, msg[1].y);
    }
    else {
        console.log(msg);
    }
});

function setColor(newColor) {
    cursorColor = newColor;
    document.getElementById("clicker").style.cursor = "url(assets/cursor2-" + newColor + ".png), pointer";
    socket.send(JSON.stringify(["color", newColor]));
}

function setAgeRate(newRate) {
    console.log(newRate);
    ageRate = newRate;
}

function setClientsCount(n) {
    otherClientsCount = n;
    document.getElementById("otherClients").innerHTML = n + " other cursor" + (n != 1 ? "s" : "");
}

function createClientCursor(id) {
    c = document.createElement("div");
    c.classList.add("c");
    c.classList.add("c-black");
    c.classList.add("client");
    c.id = "client" + id;
    c.style.left = "0";
    c.style.top = "0";
    c.style.opacity = 1;
    document.body.appendChild(c);

    clientCursors[id] = {
        color: "black",
        element: c
    };

    setClientsCount(otherClientsCount + 1);
}

function moveClientCursor(id, x, y) {
    console.log(id, x, y);
    clientCursors[id].element.style.left = (x * 100) + "%";
    clientCursors[id].element.style.top = (y * 100) + "%";
}

function setClientCursorColor(id, newColor) {
    var c = clientCursors[id];
    c.element.classList.remove("c-" + c.color);
    c.element.classList.add("c-" + newColor);
    c.color = newColor;
}

function removeClientCursor(id) {
    document.body.removeChild(clientCursors[id].element);
    clientCursors[id] = null;
    setClientsCount(otherClientsCount - 1);
}

function createCursor(x, y, color, age, announce) {
    if(!color) color = cursorColor
    if(!age) age = ageSteps - 1;
    if(announce == null) announce = true;

    var c = document.createElement("div");
    c.classList.add("c");
    c.classList.add("c-" + color);
    c.style.left = x * 100 + "%";
    c.style.top = y * 100 + "%";
    c.style.opacity = age / ageSteps;
    document.body.appendChild(c);

    cursors.push({
        remaining: age,
        element: c,
        color: color,
    });

    if(announce) {
        socket.send(JSON.stringify(["create", {
            x: x, y: y, color: color,
        }]));
    }
}

function createCursorFromMouse(event) {
    createCursor(
        event.pageX / window.innerWidth,
        event.pageY / window.innerHeight
    );
}

function ageCursors() {
    cursors.forEach((x, i) => {
        x.remaining -= 1;
        if(x.remaining > 0) {
            x.element.style.opacity = (x.remaining / ageSteps);
        }
        else {
            cursors.splice(i, 1);
            document.body.removeChild(x.element);
        }
    });

    var newAgeRate = 5000 / Math.sqrt(cursors.length);
    if(newAgeRate < 20) { newAgeRate = 20; }
    if(newAgeRate > 2000) { newAgeRate = 2000; }

    setAgeRate(newAgeRate);
    setTimeout(ageCursors, ageRate);
}

var mouseDown = false;

var clicker = document.getElementById("clicker");

clicker.addEventListener("mousedown", function() {
    createCursorFromMouse(event);
});

clicker.addEventListener("mousemove", function() {
    if(event.buttons == 1) createCursorFromMouse(event);
    socket.send(JSON.stringify(["position", {
        x: event.pageX / window.innerWidth,
        y: event.pageY / window.innerHeight,
    }]));
});

clicker.addEventListener("wheel", function() {
    var offset = 1;
    if(event.deltaY < 0) offset = -1;
    var newIdx = (colors.indexOf(cursorColor) + offset) % colors.length;
    if(newIdx < 0) newIdx = colors.length - 1;
    console.log("newIdx = " + newIdx);
    setColor(colors[newIdx]);
});

ageCursors();

