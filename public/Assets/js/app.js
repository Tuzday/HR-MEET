var AppProcess = (function() {
    var peers_connection_ids = [];
    var peers_connection = [];
    var remote_vid_stream = [];
    var remote_aud_stream = [];
    var local_div;
    var serverProcess;
    var audio;
    var isAudioMute = true;
    var rtp_aud_senders = [];
    var video_states = {
        None: 0,
        Camera: 1,
        ScreenShare: 2
    };
    var video_st = video_states.None;
    var videoCamTrack;
    var rtp_vid_senders = [];
    var my_connection_id;

    async function _init(SDP_function, my_connid) {
        serverProcess = SDP_function;
        my_connection_id = my_connid;
        eventProcess();
        local_div = document.getElementById("localVideoPlayer");
    }

   let profileImage;

function eventProcess() {
    $("#miceMuteUnmute").on("click", async function() {
        if (!audio) {
            await loadAudio();
        }
        if (!audio) {
            alert("Audio permission has not been granted");
            return;
        }
        if (isAudioMute) {
            audio.enabled = true;
            $(this).html("<span class='material-icons' style='width: 100%;'>mic</span>");
            updateMediaSenders(audio, rtp_aud_senders);
        } else {
            audio.enabled = false;
            $(this).html("<span class='material-icons' style='width: 100%;'>mic_off</span>");
            removeMediaSenders(rtp_aud_senders);
        }
        isAudioMute = !isAudioMute;
    });

    $("#videoCamOnOff").on("click", async function() {
        if (video_st == video_states.Camera) {
            await videoProcess(video_states.None);
        } else {
            await videoProcess(video_states.Camera);
        }
    });

    $("#ScreenShareOnOff").on("click", async function() {
        if (video_st == video_states.ScreenShare) {
            await videoProcess(video_states.None);
        } else {
            await videoProcess(video_states.ScreenShare);
        }
    });
}

async function loadAudio() {
    try {
        var astream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true
        });
        audio = astream.getAudioTracks()[0];
        audio.enabled = false;
    } catch (e) {
        console.log(e);
    }
}

function connection_status(connection) {
    if (connection && (connection.connectionState == "new" || connection.connectionState == "connecting" || connection.connectionState == "connected")) {
        return true;
    } else {
        return false;
    }
}

async function updateMediaSenders(track, rtp_senders) {
    for (var i = 0; i < peers_connection_ids.length; i++) {
        if (connection_status(peers_connection[peers_connection_ids[i]])) {
            if (rtp_senders[peers_connection_ids[i]] && rtp_senders[peers_connection_ids[i]].track) {
                rtp_senders[peers_connection_ids[i]].replaceTrack(track);
            } else {
                rtp_senders[peers_connection_ids[i]] = peers_connection[peers_connection_ids[i]].addTrack(track);
            }
        }
    }
}

function removeMediaSenders(rtp_senders) {
    for (var i = 0; i < peers_connection_ids.length; i++) {
        if (rtp_senders[peers_connection_ids[i]] && connection_status(peers_connection[peers_connection_ids[i]])) {
            peers_connection[peers_connection_ids[i]].removeTrack(rtp_senders[peers_connection_ids[i]]);
            rtp_senders[peers_connection_ids[i]] = null;
        }
    }
}

function removeVideoStream(rtp_senders) {
    if (videoCamTrack) {
        videoCamTrack.stop();
        videoCamTrack = null;
        local_div.srcObject = null;
        removeMediaSenders(rtp_vid_senders);
        if (profileImage) {
            profileImage.style.display = 'block';
        }
    }
}

async function videoProcess(newVideoState) {
    const localVideoPlayer = document.getElementById('localVideoPlayer');
    if (!profileImage) {
        profileImage = document.querySelector('#me .profile-image');
    }

    if (newVideoState == video_states.None) {
        $("#videoCamOnOff").html("<span class='material-icons' style='width: 100%;'>videocam_off</span>");
        $("#ScreenShareOnOff").html('<span class="material-icons">present_to_all</span><div>Present Now</div>');
        video_st = newVideoState;
        removeVideoStream(rtp_vid_senders);
        if (profileImage) {
            profileImage.style.display = 'block';
        }
        localVideoPlayer.style.display = 'none';
        return;
    }

    if (newVideoState == video_states.Camera) {
        $("#videoCamOnOff").html("<span class='material-icons' style='width: 100%;'>videocam</span>");
        if (profileImage) {
            profileImage.style.display = 'none';
        }
        localVideoPlayer.style.display = 'block';
    } else if (newVideoState == video_states.ScreenShare) {
        $("#ScreenShareOnOff").html('<span class="material-icons text-success">present_to_all</span><div class="text-success">screen_share</div>');
        if (profileImage) {
            profileImage.style.display = 'none';
        }
        localVideoPlayer.style.display = 'block';
    }

    try {
        var vstream = null;
        if (newVideoState == video_states.Camera) {
            vstream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: 1920,
                    height: 1080
                },
                audio: false
            });
        } else if (newVideoState == video_states.ScreenShare) {
            vstream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    width: 1920,
                    height: 1080
                },
                audio: false
            });
            vstream.oninactive = (e) => {
                removeVideoStream(rtp_vid_senders);
                $("#ScreenShareOnOff").html('<span class="material-icons">present_to_all</span><div>Present Now</div>');
                if (profileImage) {
                    profileImage.style.display = 'block';
                }
                localVideoPlayer.style.display = 'none';
            }
        }
        if (vstream && vstream.getVideoTracks().length > 0) {
            videoCamTrack = vstream.getVideoTracks()[0];
            if (videoCamTrack) {
                localVideoPlayer.srcObject = new MediaStream([videoCamTrack]);
                updateMediaSenders(videoCamTrack, rtp_vid_senders);
            }
        }
    } catch (e) {
        console.log(e);
        return;
    }
    video_st = newVideoState;
    if (newVideoState == video_states.Camera) {
        $("#videoCamOnOff").html('<span class="material-icons">videocam</span>');
        $("#ScreenShareOnOff").html('<span class="material-icons">present_to_all</span><div>Present Now</div>');
    } else if (newVideoState == video_states.ScreenShare) {
        $("#videoCamOnOff").html('<span class="material-icons" style="width: 100%;">videocam_off</span>');
        $("#ScreenShareOnOff").html('<span class="material-icons text-success">present_to_all</span><div class="text-success">screen_share</div>');
    }
}

var iceConfiguration = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        },
        {
            urls: "stun:stun1.l.google.com:19302"
        }
    ]
};
    async function setNewConnection(connid) {
        var connection = new RTCPeerConnection(iceConfiguration);

        connection.onnegotiationneeded = async function(event) {
            await setOffer(connid);
        };
        connection.onicecandidate = function(event) {
            if (event.candidate) {
                serverProcess(JSON.stringify({ icecandidate: event.candidate }), connid);
            }
        };
        connection.ontrack = function(event) {
            if (!remote_vid_stream[connid]) {
                remote_vid_stream[connid] = new MediaStream();
            }
            if (!remote_aud_stream[connid]) {
                remote_aud_stream[connid] = new MediaStream();
            }

            if (event.track.kind == "video") {
                remote_vid_stream[connid]
                    .getVideoTracks()
                    .forEach((t) => remote_vid_stream[connid].removeTrack(t));
                remote_vid_stream[connid].addTrack(event.track);
                var remoteVideoPlayer = document.getElementById("v_" + connid);
                remoteVideoPlayer.srcObject = null;
                remoteVideoPlayer.srcObject = remote_vid_stream[connid];
                remoteVideoPlayer.load();
            } else if (event.track.kind == "audio") {
                remote_aud_stream[connid]
                    .getAudioTracks()
                    .forEach((t) => remote_aud_stream[connid].removeTrack(t));
                remote_aud_stream[connid].addTrack(event.track);
                var remoteAudioPlayer = document.getElementById("a_" + connid);
                remoteAudioPlayer.srcObject = null;
                remoteAudioPlayer.srcObject = remote_aud_stream[connid];
                remoteAudioPlayer.load();
            }
        };
        peers_connection_ids.push(connid);
        peers_connection[connid] = connection;

        if (video_st == video_states.Camera || video_st == video_states.ScreenShare) {
            if (videoCamTrack) {
                updateMediaSenders(videoCamTrack, rtp_vid_senders);
            }
        }

        return connection;
    }

    async function setOffer(connid) {
        var connection = peers_connection[connid];
        var offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        serverProcess(JSON.stringify({ offer: connection.localDescription }), connid);
    }

    async function SDPProcess(message, from_connid) {
        message = JSON.parse(message);
        if (message.answer) {
            await peers_connection[from_connid].setRemoteDescription(new RTCSessionDescription(message.answer));
        } else if (message.offer) {
            if (!peers_connection[from_connid]) {
                await setNewConnection(from_connid);
            }
            await peers_connection[from_connid].setRemoteDescription(new RTCSessionDescription(message.offer));
            var answer = await peers_connection[from_connid].createAnswer();
            await peers_connection[from_connid].setLocalDescription(answer);
            serverProcess(JSON.stringify({ answer: answer }), from_connid);
        } else if (message.icecandidate) {
            if (!peers_connection[from_connid]) {
                await setNewConnection(from_connid);
            }
            try {
                await peers_connection[from_connid].addIceCandidate(message.icecandidate);
            } catch (e) {
                console.log(e);
            }
        }
    }

    async function closeConnection(connid) {
        peers_connection_ids = peers_connection_ids.filter(id => id !== connid);
        if (peers_connection[connid]) {
            peers_connection[connid].close();
            peers_connection[connid] = null;
        }
        if (remote_aud_stream[connid]) {
            remote_aud_stream[connid].getTracks().forEach((t) => {
                if (t.stop) t.stop();
            });
            remote_aud_stream[connid] = null;
        }
        if (remote_vid_stream[connid]) {
            remote_vid_stream[connid].getTracks().forEach((t) => {
                if (t.stop) t.stop();
            });
            remote_vid_stream[connid] = null;
        }
    }

    return {
        setNewConnection: async function(connid) {
            return await setNewConnection(connid);
        },
        init: async function(SDP_function, my_connid) {
            await _init(SDP_function, my_connid);
        },
        processClientFunc: async function(data, from_connid) {
            await SDPProcess(data, from_connid);
        },
        closeConnectionCall: async function(connid) {
            await closeConnection(connid);
        }
    };
})();


var MyApp = (function() {
    var socket = null;
    var user_id = "";
    var meeting_id = "";

    function init(uid, mid) {
        user_id = uid;
        meeting_id = mid;
        $("#meetingContainer").show();
        $("#me h2").text(user_id + "(Me)");
        document.title = user_id;
        event_process_for_signaling_server();
        eventHandeling();
    }

    function event_process_for_signaling_server() {
        socket = io.connect();

        var SDP_function = function(data, to_connid) {
            socket.emit("SDPProcess", {
                message: data,
                to_connid: to_connid,
            });
        };
        socket.on("connect", () => {
            if (socket.connected) {
                AppProcess.init(SDP_function, socket.id);
                if (user_id != "" && meeting_id != "") {
                    socket.emit("userconnect", {
                        displayName: user_id,
                        meetingid: meeting_id,
                    });
                }
            }
        });
        socket.on("inform_other_about_disconnected_user", function(data) {
            $("#" + data.connId).remove();
            $(".participant-count").text(data.uNumber);
            $("#participant_" + data.connId).remove();
            AppProcess.closeConnectionCall(data.connId);
        });

        socket.on("inform_others_about_me", function(data) {
            addUser(data.other_user_id, data.connId, data.userNumber);
            AppProcess.setNewConnection(data.connId);
        });
        socket.on("showFileMessage", function (data){
            var time = new Data();
            var ltime = time.toLocaleString("en-US", {
                hour: "numeric",
                minute: "numeric",
                hour12:true
            });
            var attachFileAreaForOther = document.querySelector(".show-attach-file");
            attachFileAreaForOther.innerHTML += "<div class='left-align' style='display: flex; align-items: center;'><img src='public/assets/images/pf.png' style='height: 40px; width: 40px;' class='caller-image circle'><div style='font-weight: 600; margin:0 5px;'>" + data.username + "</div>:<div><a style='color: #007bff;' href='" + data.filePath + "' download>" + data.fileName + "</a></div></div><br/>";
        });
        socket.on("inform_me_about_other_user", function(other_users) {
            var userNumber = other_users.length;
            var userNum = userNumber + 1;
            if (other_users) {
                for (var i = 0; i < other_users.length; i++) {
                    addUser(other_users[i].user_id, other_users[i].connectionId, userNum);
                    AppProcess.setNewConnection(other_users[i].connectionId);
                }
            }
        });
        socket.on("SDPProcess", async function(data) {
            await AppProcess.processClientFunc(data.message, data.from_connid);
        });
        function eventHandling() {
            $("#btnsend").on("click", function() {
                var msgData = $("#msgbox").val();
                socket.emit("sendMessage", msgData);
                var time = new Date();
                var lTime = time.toLocaleString("en-US", {
                    hour: "numeric",
                    minute: "numeric",
                    hour12: true,
                });
                var div = $("<div>").html(
                    "<span class='font-weight-bold mr-3' style='color:black'>" +
                    user_id +
                    "</span>" +
                    lTime +
                    "</br>" +
                    msgData
                );
                $("#messages").append(div);
                $("#msgbox").val("");
            });

            socket.on("showChatMessage", function(data) {
                var time = new Date();
                var lTime = time.toLocaleString("en-US", {
                    hour: "numeric",
                    minute: "numeric",
                    hour12: true,
                });
                var div = $("<div>").html(
                    "<span class='font-weight-bold mr-3' style='color:black'>" +
                    data.from +
                    "</span>" +
                    lTime +
                    "</br>" +
                    data.message
                );
                $("#messages").append(div);
            });
        }

        $(document).ready(function() {
            eventHandling();
        });
    
        var url = window.location.href;
        $(".meeting_url").text(url);
    
        $(".copy_info").on("click", function() {
            var tempInput = document.createElement("input");
            tempInput.value = url;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand("copy");
            document.body.removeChild(tempInput);
    
            $(".link_copied_msg").fadeIn().delay(1000).fadeOut();
        });
    
        // Update the event to trigger fullscreen on click
        $("#divUse--rs").on("click", "video", function () {
            if (this.requestFullscreen) {
                this.requestFullscreen();
            } else if (this.mozRequestFullScreen) { /* Firefox */
                this.mozRequestFullScreen();
            } else if (this.webkitRequestFullscreen) { /* Chrome, Safari and Opera */
                this.webkitRequestFullscreen();
            } else if (this.msRequestFullscreen) { /* IE/Edge */
                this.msRequestFullscreen();
            }
        });
    }
    
    $(document).ready(function() {
        eventHandling();
    });

    function addUser(other_user_id, connId, userNum) {
        var newDivid = $("#otherTemplate").clone();
        newDivid = newDivid.attr("id", connId).addClass("other");
        newDivid.find("h2").text(other_user_id);
        newDivid.find("video").attr("id", "v_" + connId);
        newDivid.find("audio").attr("id", "a_" + connId);
        newDivid.show();
        $("#divUsers").append(newDivid);
        $(".in-call-wrap-up").append('<div class="in-call-chat-wrap d-flex justify-content-between align-items-center mb-3" id="participant_' + connId + '"> <div class="participant-img-name-wrap display-center cursor-pointer"> <div class="participant-img"> <img src="public/Assets/images/HR logo1.png" alt="profile" class="border-secondary" style="height: 40px; width: 40px; border-radius: 50%;"> </div> <div class="participant-name ml-2"> ' + other_user_id + '</div> </div> <div class="participant-action-wrap display-center"> <div class="Participant-action-dot display-center mr-2 cursor-pointer"> <span class="material-icons">more_vert</span> </div> <div class="participant-action-pin display-center mr-2 cursor-pointer"> <span class="material-icons">push_pin</span> </div> </div> </div>');
        $(".participant-count").text(userNum);
    }

    $(document).on("click", ".people-heading", function() {
        $(".in-call-wrap-up").show(300);
        $(".chat-show-wrap").hide(300);
        $(this).addClass("active");
        $(".chat-heading").removeClass("active");
    });

    $(document).on("click", ".chat-heading", function() {
        $(".in-call-wrap-up").hide(300);
        $(".chat-show-wrap").show(300);
        $(this).addClass("active");
        $(".people-heading").removeClass("active");
    });

    $(document).on("click", ".meeting-heading-cross", function() {
        $(".g-right-details-wrap").hide(300);
    });

    $(document).on("click", ".top-left-participant-wrap", function() {
        $(".people-heading").addClass("active");
        $(".chat-heading").removeClass("active");
        $(".g-right-details-wrap").show(300);
        $(".in-call-wrap-up").show(300);
        $(".chat-show-wrap").hide(300);
    });

    $(document).on("click", ".top-left-chat-wrap", function() {
        $(".people-heading").removeClass("active");
        $(".chat-heading").addClass("active");
        $(".g-right-details-wrap").show(300);
        $(".in-call-wrap-up").hide(300);
        $(".chat-show-wrap").show(300);
    });

    $(document).on("click", ".end-call-wrap", function() {
        $(".top-box-show").css({
            "display": "flex"
        }).html(`
            <div class="top-box align-vertical-middle profile-dialogue-show"> 
                <h4 class="mt-3" style="text-align: center;">Leave Meeting</h4> 
                <hr> 
                <div class="call-leave-cancel-action d-flex flex-column flex-sm-row justify-content-center align-items-center w-100"> 
                    <a href="/action.html">
                        <button class="call-leave-action btn btn-danger mr-0 mr-sm-3 mb-3 mb-sm-0">Leave</button>
                    </a> 
                    <button class="call-cancel-action btn btn-secondary">Cancel</button> 
                </div> 
            </div>
        `);
    
        $(".call-cancel-action").on("click", function() {
            $(".top-box-show").css("display", "none");
        });
    });
    
    $(document).mouseup(function(e){
        var container = new Array();
        container.push($(".top-box-show"));
        $.each(container, function(key,value){
            if(!$(value).is(e.target) && $(value).has(e.target).length == 0){
                $(value).empty();
            }
        });
    });
    $(document).mouseup(function(e){
        var container = new Array();
        container.push($(".g-details"));
        container.push($(".g-right-details-wrap"));
        $.each(container, function(key,value){
            if(!$(value).is(e.target) && $(value).has(e.target).length == 0){
                $(value).hide(300);
            }
        });
    });
    $(document).on("click",".call-cancel-action", function(){
        $('.top-box-show').html("");
    });  
    //$(document).on("click", ".copy_info", function (){
       // var $temp = $("<input>");
       // $("body").append("$temp");
      //  $temp.val($(".meeting_url").text()).select();
        //document.execCommand("copy");
       // $temp.remove();
       // $(".link-conf").show();
       // setTimeout(function() {
      //      $(".link-conf").hide();
       // }, 3000);
   // });
   $(document).on("click", ".meeting-details-button", function () {
    $(".g-details").slideDown(300);
   });

   $(document).on("click", ".g-details-heading-attachment", function () {
    $(".g-details-heading-show").hide();
    $(".g-details-heading-show-attachment").show();
    $(this).addClass('active');
    $(".g-details-heading-detail").removeClass('active');
   });

   $(document).on("click", ".g-details-heading-detail", function () {
    $(".g-details-heading-show").show();
    $(".g-details-heading-show-attachment").hide();
    $(this).addClass('active');
    $(".g-details-heading-attachment").removeClass('active');
   }); 


   var base_url = window.location.origin;
   $(document).on("change", ".custom-file-input", function () {
    var fileName = $(this).val().split("\\").pop();
    $(this).siblings(".custom-file-label").addClass("selected").html(fileName);
   });

   $(document).on("click", ".share-attach", function (e) {
    e.preventDefault();
    var att_img = $("#customFile").prop('files')[0];
    var formData = new FormData();
    formData.append("zipfile", att_img);
    formData.append("meeting_id", meeting_id);
    formData.append("username", user_id);
    console.log(formData);
    $.ajax({
        url: base_url+"/attachimg",
        type:"POST",
        data: formData,
        contentType: false,
        processData: false,
        success: function(response) {
            console.log(response);
        }, 
        error: function() {
            console.log("error");
        },
    });

    var attachFileArea = document.querySelector(".show-attach-file");
    var attachFileName = $("customFile").val().split("\\").pop();
    var attachFilePath = "public/attachment/"+meeting_id+"/"+attachFileName+"";
    attachFileArea.innerHTML += "<div class='left-align' style='display: flex; align-items: center;'><img src='public/assets/images/pf.png' style='height: 40px; width:40px;' class='caller-image circle'><div style='font-weight: 600; margin:0 5px;'>" + user_id + "</div>:<div><a style='color: #007bff;' href='"+attachFilePath+"' download>"+attachFileName+"</a></div></div><br/>";
    $("label.custom-file-label").text("");
    socket.emit("fileTransferToOther", {
        username: user_id,
        meetingid: meeting_id,
        filePath:attachFilePath,
        fileName: attachFileName
    });
});
$(document).on("click", ".option-icon", function() {
    $(".recording-show").toggle(300);
});

$(document).on("click", ".start-record", function() {
    $(this).removeClass().addClass("stop-record btn-danger text-dark style='border-radius: 5px;'").text("Stop Recording");
    startRecording();
});

$(document).on("click", ".stop-record", function() {
    $(this).removeClass().addClass("start-record btn-dark text-danger style='border-radius: 5px;'").text("Start Recording");
    mediaRecorder.stop();
});

var mediaRecorder;
var chunks = [];

async function captureScreen(mediaConstraints = { video: true }) {
    const screenStream = await navigator.mediaDevices.getDisplayMedia(mediaConstraints);
    return screenStream;
}

async function captureAudio(mediaConstraints = { video: false, audio: true }) {
    const audioStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
    return audioStream;
}

async function startRecording() {
    // Clear the chunks array before starting a new recording
    chunks = [];
    
    const screenStream = await captureScreen();
    const audioStream = await captureAudio();
    const stream = new MediaStream([...screenStream.getTracks(), ...audioStream.getTracks()]);
    
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();
    
    mediaRecorder.ondataavailable = function(e) {
        chunks.push(e.data);
    };

    mediaRecorder.onstop = function(e) {
        var clipName = prompt("Enter a name for your recording", "ConferX_recording");
        stream.getTracks().forEach((track) => track.stop()); // Corrected typo here
        
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = clipName + ".webm";
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
    };
}

document.addEventListener('DOMContentLoaded', (event) => {
    const localVideo = document.getElementById('localVideoPlayer');
    const profileImage = localVideo.previousElementSibling;

    const checkVideoPlaying = () => {
        if (localVideo.readyState >= 2 && !localVideo.paused && !localVideo.ended) {
            profileImage.classList.add('hidden');
        } else {
            profileImage.classList.remove('hidden');
        }
    };

    // Initial check
    checkVideoPlaying();

    // Listen to video events
    localVideo.addEventListener('play', checkVideoPlaying);
    localVideo.addEventListener('pause', checkVideoPlaying);
    localVideo.addEventListener('ended', checkVideoPlaying);

    // Handle video off case (for browsers that might not fire the pause or ended event)
    localVideo.addEventListener('emptied', checkVideoPlaying);
    localVideo.addEventListener('stalled', checkVideoPlaying);
});

var username = "";
function send_message(conv,message){
	if (conv.length > 4) {
			conv = conv + "<br>";
	}
	$("#converse").html(conv +"<span class = 'current-msg'>" + "<span id='chat-bot'>Mo-Pal: </span>" + message + "</span>");
	$(".current-msg").hide();
	$(".current-msg").delay(500).fadeIn();
	$(".current-msg").removeClass("current-msg");
}

function get_username(conv){
	send_message(conv,"Hi, what's your name?");
}

function ai(conv,message){
	if (username<4) {
		username = message;
		send_message(conv,"Hi, "+ username + ". How are you?");
	}
	else{
		// $("#send").click(function(){
		    $.get("getresponse.php", {q:message}, function(data, status){
		        // alert("Data: " + data + "\nStatus: " + status);
		        send_message(conv,data);
		    });
		// }); 		 
	}
}

$(function(){
	var open = false;
	var conv = $("#converse").html();
	get_username(conv);
	$("#send").click(function(){
		var usermsg = $("#textbox").val();
		conv = $("#converse").html();
		console.log(conv.length);
		if (usermsg != "") {
			$("#textbox").val("");
			if (conv.length > 4) {
				conv = conv + "<br>";
			}
			$("#converse").html(conv + "<span id='chat-user'>You: </span>" + usermsg);
			$("#converse").scrollTop($("#converse").prop("scrollHeight"));
			conv = $("#converse").html();
			ai(conv,usermsg);
		}
	});
	$("#chat-button").click(function(){
		$("#chat-box").animate({"right":"0px"});	
	});
	$("#cancel").click(function(){
		$("#chat-box").animate({"right":"-300px"});
	});
});

    return {
        _init: function(uid, mid) {
            init(uid, mid);
        },
    };
})();
