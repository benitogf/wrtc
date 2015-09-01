'use strict'

var $ = window.jQuery = require('jquery')
//var tones = require('./tones');
var pum = require('promise-user-media');
var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
var Peer = require('simple-peer')

// var currentKeys = [];
// var keys = {
//   90: 'c',
//   88: 'd',
//   67: 'e',
//   86: 'f',
//   66: 'g',
//   78: 'a',
//   77: 'b',
//   83: 'c#',
//   68: 'd#',
//   71: 'f#',
//   72: 'g#',
//   74: 'a#'
// };
// function keyUp(e){
//   var key = e.keyCode || e.which;
//   console.log(key);
//   var ck = currentKeys.indexOf(key);
//   currentKeys.splice(ck, 1);
// }
// function keyDown(e){
//   var key = e.keyCode || e.which;
//   if ((keys[key])&&(currentKeys.indexOf(key) === -1)) {
//       currentKeys.push(key);
//       tones.play(keys[key], 3);
//   }
// }
// window.addEventListener('keydown', keyDown);
// window.addEventListener('keyup', keyUp);

var localVideo = document.getElementById('localVideo');
var clients = document.getElementById('clients');
var hula = document.getElementById('hula');
localVideo.onloadedmetadata = function(e) {
      // Do something with the video here.
      console.log('loaded stream data');
};
   

var peer,
    localStream,
    canvasWidth,
    canvasHeight,
    analyserContext,
    analyserNode,
    rafID;

var socket = require('socket.io-client')('http://localhost:9000');
    socket.on('connect', function(){
      socket.emit('getNames');
    });
    socket.on('getNames', function(data){
      if (location.hash !== '#call') {
      clients.innerHTML = '';
      data.forEach(function(client){
        var li = document.createElement('li');
        li.innerHTML = client.name;
        li.dataset.signalId = client.id;
        li.dataset.signal = JSON.stringify(client.signal);
        li.style.cursor = 'pointer';
        li.addEventListener('click', clickClient);
        clients.appendChild(li);
      });
      }
    });
    socket.on('rel', function(){
      socket.emit('getNames');
    });
    socket.on('answer', function(data){
      console.log(data);
      if (peer !== null) {
         peer.signal(data)
         } else {
             console.log('loading peer conection')
      }
    });
    socket.on('disconnect', function(){
      console.log('disconnect')
    });

function clickClient(e){
  if (peer !== null) {
     peer.signal(JSON.parse(e.target.dataset.signal))
     } else {
       console.log('loading peer conection')
     }
  if (location.hash !== '#call') {
     localStorage.setItem("caller", e.target.dataset.signalId);
  }
}

function attachMediaStream(element, stream) {
    element.src = window.URL.createObjectURL(stream);
}

function onCreateSessionDescriptionError(error) {
  console.log('Failed to create session description: ' + error.toString());
}

function onCreateOfferSuccess(desc) {
  console.log(desc);
}

//http://webaudiodemos.appspot.com/AudioRecorder/js/main.js
function updateAnalysers(){
  if (!analyserContext) {
     var canvas = document.getElementById("analyser");
     canvasWidth = canvas.width;
     canvasHeight = canvas.height;
     analyserContext = canvas.getContext('2d');
  }
  if (location.hash === '#call') {
    var SPACING = 5;
    var BAR_HEIGHT = 350;
    var BAR_WIDTH = 5;
    var numBars = Math.round(canvasWidth / SPACING);
    //console.log(numBars);
    var freqByteData = new Uint8Array(analyserNode.frequencyBinCount);
    analyserNode.getByteFrequencyData(freqByteData);
    var multiplier = analyserNode.frequencyBinCount / numBars;
    // Draw rectangle for each frequency bin.
    for (var i = 0; i < numBars; ++i) {
        var magnitude = 0;
        var offset = Math.floor( i * multiplier );
        // gotta sum/average the block, or we miss narrow-bandwidth spikes
        for (var j = 0; j< multiplier; j++){
            magnitude += freqByteData[offset + j];
        }
        magnitude = magnitude / multiplier;
        var magnitude2 = freqByteData[i * multiplier];
        analyserContext.fillStyle = "rgba( " + Math.round((i*360)/numBars) + ", 155, 155, 0.6)";
        analyserContext.fillRect(i * SPACING, canvasHeight, BAR_WIDTH, magnitude*-0.2);
    }
  }
  analyserContext.drawImage(hula, 0, 0, canvasWidth, canvasHeight);
  rafID = window.requestAnimationFrame( updateAnalysers );
}

function openPeer(stream) {
  if (location.hash === '#call') {
     peer = new Peer({ initiator: true, trickle: false, stream: stream })
  } else {
     peer = new Peer({ initiator: false, trickle: false })
  }
  
  peer.on('error', function (err) { console.log('error', err) })
  
  peer.on('signal', function (data) {
    if (data.type === 'answer') {
       var signal = {
         callerId: localStorage.getItem("caller"),
         data: data
       };
      socket.emit('answer', signal);
    } else {
      socket.emit('getNames', data);
    }
  });
  
  peer.on('connect', function () {
    console.log('CONNECT');
    //peer.send('whatever' + Math.random());
  });
  
  // peer.on('data', function (data) {
  //   console.log('data: ' + data)
  // });
  peer.on('stream', function (stream) {
    localVideo.src = window.URL.createObjectURL(stream);
  });
}

function gotStream(stream) {
  openPeer(stream);
  attachMediaStream(localVideo, stream);
  localStream = stream;
  var inputPoint = audioCtx.createGain();
  var realAudioInput = audioCtx.createMediaStreamSource(stream);
  realAudioInput.connect(inputPoint);
  analyserNode = audioCtx.createAnalyser();
  analyserNode.fftSize = 2048;
  inputPoint.connect( analyserNode );
  updateAnalysers();
}

function start() {
  if (!navigator.cancelAnimationFrame)
      navigator.cancelAnimationFrame = navigator.webkitCancelAnimationFrame || navigator.mozCancelAnimationFrame;
  if (!navigator.requestAnimationFrame)
      navigator.requestAnimationFrame = navigator.webkitRequestAnimationFrame || navigator.mozRequestAnimationFrame;
      
  // tones.attack = 0;
  // tones.release = 300;
  // tones.type = 'custom';
  // tones.waveRange = [-2, -1.5, -0.5, 0, 0.5, 1.5, 2];
  // tones.wave = function(t) {
  //   return Math.sin(t* 400);
  // };
  if (location.hash === '#call') {
     pum({
       audio: true,
       video: true
     }).then(gotStream).catch(function(error){
       console.log('getUserMedia: ' + error.name + "\n" + error.message);
     });
    } else {
      openPeer();
      updateAnalysers();
    }
}

$(document).ready(function() {
        start();
        setTimeout(function(){
           $('#content').css('opacity', '1');
        }, 300);
});
