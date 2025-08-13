"use strict";exports.id=2019,exports.ids=[2019],exports.modules={4400:(a,b,c)=>{c.d(b,{default:()=>h});var d=c(4426);class e{constructor(a,b,c,d){this.saveImageToServer=a,this.setCaptureCounter=b,this.setProcessStatus=c,this.toggleTopBar=d,this.captureFolder="eye_tracking_captures"}showCapturePreview(a,b,c){let d=document.createElement("div");d.style.cssText=`
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        gap: 20px;
        background-color: rgba(0, 0, 0, 0.85);
        padding: 20px;
        border-radius: 12px;
        z-index: 999999;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.6);
        opacity: 1;
        transition: opacity 0.3s ease;
      `;let e=(a,b)=>{if(!a)return null;let c=document.createElement("div");c.style.cssText=`
          display: flex;
          flex-direction: column;
          align-items: center;
        `;let d=document.createElement("img");d.src=a,d.style.cssText=`
          max-width: 320px;
          max-height: 240px;
          border: 3px solid white;
          border-radius: 8px;
          background-color: #333;
        `,d.onload=()=>console.log(`${b} image loaded successfully`),d.onerror=a=>console.error(`Error loading ${b} image:`,a);let e=document.createElement("div");return e.textContent=b,e.style.cssText=`
          color: white;
          font-size: 14px;
          margin-top: 10px;
          font-weight: bold;
        `,c.appendChild(d),c.appendChild(e),c},f=document.createElement("div");f.style.cssText=`
        position: absolute;
        top: -30px;
        left: 0;
        width: 100%;
        color: white;
        font-size: 12px;
        text-align: center;
      `,f.textContent=`Screen: ${a?"YES":"NO"}, Webcam: ${b?"YES":"NO"}`,d.appendChild(f);let g=e(a,"Screen Capture");g&&d.appendChild(g);let h=e(b,"Webcam Capture");if(h&&d.appendChild(h),c){let a=document.createElement("div");a.textContent=`Dot position: x=${Math.round(c.x)}, y=${Math.round(c.y)}`,a.style.cssText=`
          color: #ffcc00;
          font-size: 14px;
          position: absolute;
          top: -50px;
          left: 0;
          width: 100%;
          text-align: center;
        `,d.appendChild(a)}let i=document.createElement("div");i.textContent="2.0s",i.style.cssText=`
        position: absolute;
        bottom: -25px;
        right: 20px;
        color: white;
        font-size: 12px;
        background-color: rgba(0, 0, 0, 0.7);
        padding: 3px 8px;
        border-radius: 4px;
      `,d.appendChild(i),document.body.appendChild(d);let j=2,k=setInterval(()=>{(j-=.1)<=0?(clearInterval(k),d.style.opacity="0",setTimeout(()=>{d.parentNode&&d.parentNode.removeChild(d)},300)):i.textContent=`${j.toFixed(1)}s`},100);setTimeout(()=>{d.parentNode&&d.parentNode.removeChild(d)},5e3)}async captureWebcamImage(a){let b=null,c=null;try{let d=`webcam_${String(a).padStart(3,"0")}.jpg`;b=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:4096},height:{ideal:2160},facingMode:"user"},audio:!1}),(c=document.createElement("video")).autoplay=!0,c.playsInline=!0,c.muted=!0,c.style.position="absolute",c.style.left="-9999px",c.style.opacity="0",document.body.appendChild(c),c.srcObject=b,await new Promise(a=>{let b=setTimeout(()=>{console.warn("Video loading timed out, continuing anyway"),a()},1e3);c.onloadeddata=()=>{clearTimeout(b),a()}}),await new Promise(a=>setTimeout(a,200));let e=c.videoWidth||640,f=c.videoHeight||480;console.log(`Capturing at resolution: ${e}x${f}`);let g=document.createElement("canvas");g.width=e,g.height=f,g.getContext("2d").drawImage(c,0,0,e,f);let h=g.toDataURL("image/jpeg",.95);return await this.saveImageToServer(h,d,"webcam",this.captureFolder),b.getTracks().forEach(a=>a.stop()),c.remove(),!0}catch(a){return console.error("Error capturing webcam image:",a),b&&b.getTracks().forEach(a=>a.stop()),c&&c.remove(),!1}}async captureScreenImage(a,b){try{let c=`screen_${String(b).padStart(3,"0")}.jpg`,d=a.current;if(!d)return console.error("Canvas reference is null"),{imageData:null,saveResponse:null};let e=d.toDataURL("image/png");if(this.saveImageToServer){let a=await this.saveImageToServer(e,c,"screen",this.captureFolder);return console.log(`Saved screen image: ${c}, response:`,a),{imageData:e,saveResponse:a}}return{imageData:e,saveResponse:null}}catch(a){return console.error("Error capturing screen image:",a),{imageData:null,saveResponse:null}}}async saveParameterCSV(a,b){try{let c=`parameter_${String(a).padStart(3,"0")}.csv`,d=["name,value",...Object.entries(b).map(([a,b])=>`${a},${b}`)].join("\n"),e=new Blob([d],{type:"text/csv"}),f=new FileReader,g=await new Promise(a=>{f.onloadend=()=>a(f.result),f.readAsDataURL(e)});if(this.saveImageToServer){let a=await this.saveImageToServer(g,c,"parameters",this.captureFolder);return console.log(`Saved parameter CSV: ${c}`),a}return null}catch(a){return console.error("Error saving parameter CSV:",a),null}}async captureAndShowPreview(a,b,c){try{console.log(`Starting capture process with counter: ${a}`);let{imageData:d,saveResponse:e}=await this.captureScreenImage(b,a),f=a;e&&e.captureNumber&&(f=e.captureNumber,console.log(`Server assigned capture number: ${f}`));let g=await this.captureWebcamImage(f),h={dot_x:c?c.x:0,dot_y:c?c.y:0,canvas_width:b.current?b.current.width:0,canvas_height:b.current?b.current.height:0,window_width:window.innerWidth,window_height:window.innerHeight,timestamp:new Date().toISOString()};await this.saveParameterCSV(f,h),this.setCaptureCounter&&(e&&e.captureNumber?this.setCaptureCounter(e.captureNumber+1):this.setCaptureCounter(a=>a+1)),this.setProcessStatus&&this.setProcessStatus(`Captured with dot at: x=${c?.x}, y=${c?.y}`),this.showCapturePreview(d,g?"webcam_image_data":null,c),setTimeout(()=>{"function"==typeof this.toggleTopBar&&this.toggleTopBar(!0)},2200),setTimeout(()=>{this.setProcessStatus&&this.setProcessStatus("")},3e3)}catch(a){console.error("Error during capture and preview:",a),this.setProcessStatus&&this.setProcessStatus("Error: "+a.message),setTimeout(()=>{"function"==typeof this.toggleTopBar&&this.toggleTopBar(!0)},1500),setTimeout(()=>{this.setProcessStatus&&this.setProcessStatus("")},3e3)}}}let f=(a,b,c,d=12)=>(a.beginPath(),a.arc(b,c,d,0,2*Math.PI),a.fillStyle="red",a.fill(),a.beginPath(),a.arc(b,c,d+3,0,2*Math.PI),a.strokeStyle="rgba(255, 0, 0, 0.5)",a.lineWidth=3,a.stroke(),{x:b,y:c});class g{constructor(a){this.canvasRef=a.canvasRef,this.toggleTopBar=a.toggleTopBar,this.setOutputText=a.setOutputText,this.captureCounter=a.captureCounter||1,this.setCaptureCounter=a.setCaptureCounter,this.captureFolder=a.captureFolder||"eye_tracking_captures",this.onComplete=a.onComplete,this.calibrationPoints=a.calibrationPoints||[],this.captureHandler=new e(async(a,b,c,d)=>{try{let d=await fetch("/api/save-capture",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({imageData:a,filename:b,type:c,folder:this.captureFolder})});if(!d.ok)return console.warn(`Server responded with ${d.status}`),{};return await d.json()}catch(a){return console.error(`Error saving ${c}:`,a),{}}},a=>{"function"==typeof a?this.captureCounter=a(this.captureCounter):this.captureCounter=a,this.setCaptureCounter&&this.setCaptureCounter(this.captureCounter)},a=>{this.setOutputText&&this.setOutputText(a)},this.toggleTopBar),this.isProcessing=!1,this.currentPointIndex=0,this.statusIndicator=null}createStatusIndicator(){document.querySelectorAll(".calibrate-status-indicator").forEach(a=>a.remove());let a=document.createElement("div");return a.className="calibrate-status-indicator",a.style.cssText=`
      position: fixed;
      top: 10px;
      right: 10px;
      background-color: rgba(0, 102, 204, 0.9);
      color: white;
      font-size: 14px;
      font-weight: bold;
      padding: 8px 12px;
      border-radius: 6px;
      z-index: 9999;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    `,document.body.appendChild(a),this.statusIndicator=a,a}async processCalibrationPoint(a,b,c){try{if(!a||"number"!=typeof a.x||"number"!=typeof a.y)throw Error("Invalid calibration point");this.statusIndicator&&(this.statusIndicator.textContent=`Processing point ${b+1}/${c}`);let d=this.canvasRef.current;if(!d)throw Error("Canvas not available");let e=d.getContext("2d");f(e,a.x,a.y);let g=d.getBoundingClientRect(),h=document.createElement("div");h.className="calibrate-countdown",h.style.cssText=`
        position: fixed;
        left: ${g.left+a.x}px;
        top: ${g.top+a.y-60}px;
        transform: translateX(-50%);
        color: red;
        font-size: 36px;
        font-weight: bold;
        text-shadow: 0 0 10px white, 0 0 20px white;
        z-index: 9999;
        background-color: rgba(255, 255, 255, 0.8);
        border: 2px solid red;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        display: flex;
        justify-content: center;
        align-items: center;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
      `,document.body.appendChild(h);for(let d=3;d>0;d--)h.textContent=d,this.setOutputText?.(`Point ${b+1}/${c} - countdown ${d}`),f(e,a.x,a.y),await new Promise(a=>setTimeout(a,800));return h.textContent="✓",this.setOutputText?.(`Capturing point ${b+1}/${c}`),setTimeout(()=>{h.parentNode&&h.parentNode.removeChild(h)},300),await this.captureHandler.captureAndShowPreview(this.captureCounter,this.canvasRef,a)||console.warn(`No capture result for point ${b+1}`),await new Promise(a=>setTimeout(a,2500)),!0}catch(a){return console.error(`Error processing point ${b+1}:`,a),this.statusIndicator&&(this.statusIndicator.textContent=`Error: ${a.message}`),this.setOutputText?.(`Error: ${a.message}`),!1}}async startCalibration(){if(this.isProcessing)return!1;this.isProcessing=!0,this.toggleTopBar&&this.toggleTopBar(!1),this.createStatusIndicator().textContent="Initializing calibration...";try{let a=this.canvasRef.current;if(!a||0===a.width||0===a.height)throw Error("Canvas is not ready");if((!this.calibrationPoints||0===this.calibrationPoints.length)&&(this.calibrationPoints=(0,d.generateCalibrationPoints)(a.width,a.height),!this.calibrationPoints||0===this.calibrationPoints.length))throw Error("Failed to generate calibration points");this.setOutputText?.(`Starting calibration with ${this.calibrationPoints.length} points`);let b=0;for(let a=0;a<this.calibrationPoints.length;a++)await this.processCalibrationPoint(this.calibrationPoints[a],a,this.calibrationPoints.length)&&b++,await new Promise(a=>setTimeout(a,800));this.setOutputText?.(`Calibration completed: ${b}/${this.calibrationPoints.length} points captured`),this.statusIndicator&&(this.statusIndicator.textContent=`Calibration complete: ${b}/${this.calibrationPoints.length} points`),this.toggleTopBar&&this.toggleTopBar(!0),this.onComplete&&this.onComplete()}catch(a){return console.error("Error during capture and preview:",a),this.setProcessStatus&&this.setProcessStatus("Error: "+a.message),setTimeout(()=>{"function"==typeof this.toggleTopBar&&this.toggleTopBar(!0)},1500),{screenImage:"",webcamImage:"",success:!1}}finally{this.isProcessing=!1,setTimeout(()=>{this.statusIndicator&&this.statusIndicator.parentNode&&this.statusIndicator.parentNode.removeChild(this.statusIndicator)},3e3)}}}let h=g}};