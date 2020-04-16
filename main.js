if (!location.hash) {
    location.hash = Math.floor(Math.random() * 0xFFFFFF).toString(16);
}

const roomHash = location.hash.substring(1)

const configuration = {
    iceServers: [{
        urls: 'stun:stun.l.google.com:19302'
    }]
}

function onSuccess() {}
function onError(error) {
    console.error(error)
}

const roomName = 'observable' + roomHash
let room
const drone = new ScaleDrone('yiS12Ts5RdNhebyM')

drone.on('open', error => {
    if (error) {
        return onError(error)
    }
    room = drone.subscribe(roomName)
    room.on('open', error => {
        if (error) {
            onError(error)
        }
    })

    room.on('members', members => {
        if (room.length >= 3) {
            return alert('Room is already full')
        }

        const isOfferer = members.length === 2
        startWebRTC(isOfferer)
        startListeningToSignals()
    })
})

function sendMessage(message) {
    drone.publish({
        room: roomName,
        message
    })
}

let pc
function startWebRTC(isOfferer) {
    pc = new RTCPeerConnection(configuration)

    pc.onicecandidate = event => {
        if (event.candidate) {
            sendMessage({'candidate': event.candidate})
        }
    }

    if (isOfferer) {
        pc.onnegotiationneeded = () => {
            pc.createOffer().then(localDescCreated).catch(onError)
        }
    }

    pc.onaddstream = event => {
        remoteVideo.srcObject = event.stream
    }

    navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
    }).then(stream => {
        localVideo.srcObject = stream
        pc.addStream(stream)
    }, onError)

    function startListeningToSignals() {
        room.on('data', (message, client) => {
            if (!client || client.id === drone.clientId) {
                return
            }

            if (message.sdp) {
                pc.setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
                    if (pc.remoteDescription.type === 'offer') {
                        pc.createAnswer().then(localDescCreated).catch(onError)
                    }
                }, onError)
            } else if (message.candidate) {
                new RTCIceCandidate(message.candidate), onSuccess, onError
            }
        })
    }
}

function localDescCreated(desc) {
    pc.setlocalDescription(
        desc,
        () => sendMessage({'sdp': pc.localDescription}),
        onError
    )
}