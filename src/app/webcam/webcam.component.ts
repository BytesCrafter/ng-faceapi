import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import * as faceapi from 'face-api.js';

@Component({
  selector: 'app-webcam',
  templateUrl: './webcam.component.html',
  styleUrls: ['./webcam.component.css']
})
export class WebcamComponent implements OnInit {
  //@ViewChild('video', { static: true })
  //public video: ElementRef;

  constructor(
    //private faceapi: FaceDetectionNet
  ) {
    //faceapi.loadFromUri('src/assets/models');
  }

  videoId: any;
  canvasId: any;
  canvasEl: any;
  canvasRef: any;

  focusValue = 1;
  videoStream: any = null;

  fullname: any = 'Initializing...';

  async ngOnInit() {
    await Promise.all([
      await faceapi.nets.tinyFaceDetector.loadFromUri('../../assets/models'),
      await faceapi.nets.faceLandmark68Net.loadFromUri('../../assets/models'),
      await faceapi.nets.faceRecognitionNet.loadFromUri('../../assets/models'),
      await faceapi.nets.faceExpressionNet.loadFromUri('../../assets/models'),
      await faceapi.nets.ageGenderNet.load('../../assets/models'),
      await faceapi.nets.ssdMobilenetv1.loadFromUri('../../assets/models'),
    ]).then(() => this.startVideo());
  }

  async startVideo() {
    this.videoId = document.getElementById('videoId');
    this.canvasRef = document.getElementById('canvasRef');

    this.videoStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: 720,
        height: 720,
        facingMode: 'user'
      },
      audio: false
    })
    .then(stream => {
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities();
      const focusInt: number = this.focusValue;

      // if (!capabilities.focusDistance) {
      //   console.log('Sorry, manual focus not supported!');
      // } else {
      //   track.applyConstraints({
      //     advanced: [{
      //         focusMode: 'manual',
      //         focusDistance: focusInt
      //     }]
      //   });
      // }

      this.videoId.srcObject = stream;
      this.videoId.setAttribute('playsinline', true);
      this.videoId.play();
    })
    .catch(err => console.error('getUserMedia() failed: ', err))
    .finally(() => {
      console.log('Video stream started.');
      this.detect_Faces();
    });
  }

  async detect_Faces() {

    //FaceMatch
    const grading = 0.5; //below 50%
    const labelledFaceDescriptor = await this.loadLabeledImages();
    const faceMatch = new faceapi.FaceMatcher(labelledFaceDescriptor, grading);

      this.fullname = 'Preparing video...';
      setTimeout(async () => {
        this.fullname = 'Capturing Face data...';

        this.canvasId = await faceapi.createCanvasFromMedia(this.videoId);

        this.canvasEl = this.canvasRef;
        this.canvasEl.appendChild(this.canvasId);
        this.canvasId.setAttribute('id', 'canvasId');
        this.canvasId.setAttribute(
            'style',`position: fixed;
            top: 0;
            left: 0;`
        );

        var displaySize = {
          width: this.videoId.width,
          height: this.videoId.height,
        };
        faceapi.matchDimensions(this.canvasId, displaySize);

        setInterval(async () => {
          let detection = await faceapi.detectAllFaces(this.videoId,  new  faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptors()
          .withFaceExpressions()
          .withAgeAndGender();
          let resizedDetections = faceapi.resizeResults(detection, displaySize);

          this.canvasId.getContext('2d').clearRect(0, 0, this.canvasId.width, this.canvasId.height);
          faceapi.draw.drawDetections(this.canvasId, resizedDetections);
          faceapi.draw.drawFaceLandmarks(this.canvasId, resizedDetections);
          faceapi.draw.drawFaceExpressions(this.canvasId, resizedDetections);
          resizedDetections.forEach( detection => {
            const box = detection.detection.box
            const drawBox = new faceapi.draw.DrawBox(box, { label: Math.round(detection.age) + " year old " + detection.gender })
            drawBox.draw(this.canvasId)
          })

          //FaceMatch
          const results = resizedDetections.map(d =>
            faceMatch.findBestMatch(d.descriptor)
          );
          results.forEach((res, i) => {

            let age: number = 0;
            let gender: any = 'unknown';
            let mood: any = 'unknown';
            resizedDetections.forEach( detection => {
              age = Math.round(detection.age);
              gender = detection.gender;
              const moods = detection.expressions.asSortedArray();
              mood = moods[0].expression +' > '+ (Math.round(moods[0].probability*100)/100);
            })

            this.fullname = res.label+' - '+(Math.round(res.distance*100)/100)+` (${gender} @ ${age}yo) ${mood}`;
          })

          if(results.length == 0) {
            this.fullname = 'Show your face...';
          }
        }, 500);

        let detection = await faceapi.detectAllFaces(this.videoId,  new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors();
      }, 500);

  }

  loadLabeledImages() {
    const faces = ['caezar', 'linus', 'matthew', 'raphael'];
    return Promise.all(
      faces.map(async faceOwner => {
        const decriptions: any = [];
        for(var face=1; face < 2; face++) {
          const uri = `http://localhost:4200/assets/faces/${faceOwner}/${face}.jpg`; //console.log(uri);
          const image = await faceapi.fetchImage(uri);
          const detection = await faceapi.detectSingleFace(image).withFaceLandmarks().withFaceDescriptor();
          decriptions.push(detection?.descriptor);
        }
        return new faceapi.LabeledFaceDescriptors(faceOwner, decriptions)
      })
    );
  }
}
