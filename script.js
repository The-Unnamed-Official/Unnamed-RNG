let inventory = JSON.parse(localStorage.getItem('inventory')) || [];
let currentPage = 1;
const itemsPerPage = 10;
let rollCount = parseInt(localStorage.getItem('rollCount')) || 0;

// Update the displayed roll count on page load
document.getElementById("rollCountDisplay").innerText = rollCount;

function load() {
    document.addEventListener('DOMContentLoaded', (event) => {
        // Load inventory from local storage
        const storedInventory = localStorage.getItem('inventory');
        if (storedInventory) {
            inventory = JSON.parse(storedInventory);
        }
        renderInventory();
    });
}

load();

document.getElementById("rollButton").addEventListener("click", function() {
    let rollButton = document.getElementById("rollButton");

    if (rollCount < 1) {
        rollCount++;
    }

    // Update the displayed roll count
    document.getElementById("rollCountDisplay").innerText = rollCount;

    let rarity = rollRarity();
    let title = selectTitle(rarity);
    
    rollButton.disabled = true;

    // Stop any playing audio
    let suspenseAudio = document.getElementById("suspenseAudio");
    let geezerSuspenceAudio = document.getElementById("geezerSuspenceAudio");
    let polarrSuspenceAudio = document.getElementById("polarrSuspenceAudio");
    let scareSuspenceAudio = document.getElementById("scareSuspenceAudio");
    let isekaiAudio = document.getElementById("isekaiAudio");
    let emerAudio = document.getElementById("emerAudio");
    let samuraiAudio = document.getElementById("samuraiAudio");
    let contAudio = document.getElementById("contAudio");
    let unstoppableAudio = document.getElementById("unstoppableAudio");
    let gargantuaAudio = document.getElementById("gargantuaAudio");
    let oblAudio = document.getElementById("oblAudio");
    let frightAudio = document.getElementById("frightAudio");
    let sovereignAudio = document.getElementById("sovereignAudio");
    let engorspaAudio = document.getElementById("engorspaAudio");
    let unnamedAudio = document.getElementById("unnamedAudio");
    let overtureAudio = document.getElementById("overtureAudio");
    let impeachedAudio = document.getElementById("impeachedAudio");
    let rngmasterAudio = document.getElementById("rngmasterAudio");
    let silcarAudio = document.getElementById("silcarAudio");
    let brainrotAudio = document.getElementById("brainrotAudio");
    let gregAudio = document.getElementById("gregAudio");
    let mintllieAudio = document.getElementById("mintllieAudio");
    let geezerAudio = document.getElementById("geezerAudio");
    let polarrAudio = document.getElementById("polarrAudio");
    let surferAudio = document.getElementById("surferAudio");
    let oppAudio = document.getElementById('oppAudio');
    let oppSuspenceAudio = document.getElementById('oppSuspenceAudio');

    suspenseAudio.pause();
    geezerSuspenceAudio.pause();
    polarrSuspenceAudio.pause();
    scareSuspenceAudio.pause();
    isekaiAudio.pause();
    emerAudio.pause();
    samuraiAudio.pause();
    contAudio.pause();
    unstoppableAudio.pause();
    gargantuaAudio.pause();
    oblAudio.pause();
    frightAudio.pause();
    sovereignAudio.pause();
    engorspaAudio.pause();
    unnamedAudio.pause();
    overtureAudio.pause();
    impeachedAudio.pause();
    rngmasterAudio.pause();
    silcarAudio.pause();
    brainrotAudio.pause();
    gregAudio.pause();
    mintllieAudio.pause();
    geezerAudio.pause();
    polarrAudio.pause();
    surferAudio.pause();
    oppAudio.pause();
    oppSuspenceAudio.pause();

    suspenseAudio.currentTime = 0;
    geezerSuspenceAudio.currentTime = 0;
    polarrSuspenceAudio.currentTime = 0;
    scareSuspenceAudio.currentTime = 0;
    isekaiAudio.currentTime = 0;
    emerAudio.currentTime = 0;
    samuraiAudio.currentTime = 0;
    contAudio.currentTime = 0;
    unstoppableAudio.currentTime = 0;
    gargantuaAudio.currentTime = 14.5;
    oblAudio.currentTime = 0;
    frightAudio.currentTime = 0;
    sovereignAudio.currentTime = 30;
    engorspaAudio.currentTime = 12.5;
    unnamedAudio.currentTime = 0;
    overtureAudio.currentTime = 0;
    impeachedAudio.currentTime = 0;
    rngmasterAudio.currentTime = 0;
    silcarAudio.currentTime = 0;
    brainrotAudio.currentTime = 0;
    gregAudio.currentTime = 0;
    mintllieAudio.currentTime = 37;
    geezerAudio.currentTime = 0;
    polarrAudio.currentTime = 0;
    surferAudio.currentTime = 0;
    oppAudio.currentTime = 0;
    oppSuspenceAudio.currentTime = 0;

    if (rarity.type === 'Surfer [???]' || rarity.type === '0pPre2s10N [GliTcH]' || rarity.type === 'Unstoppable [1 in 112]' || rarity.type === 'Isekai [1 in 300]' || rarity.type === 'Emergencies [1 in 500]' || rarity.type === 'Samurai [1 in 800]' || rarity.type === 'Contortions [1 in 999]' || rarity.type === 'Gargantua [1 in 143]' || rarity.type === 'Oblivion [1 in 200]' || rarity.type === 'Fright [1 in 1,075]' || rarity.type === 'Sovereign [1 in 1,266]' || rarity.type === 'English or Spanish [1 in 25,641]' || rarity.type === 'Unnamed [1 in 13,889]' || rarity.type === 'Overture [1 in 25,641]' || rarity.type === 'Impeached [1 in 101,010]' || rarity.type === 'RNG Master [1 in 1,430,615]' || rarity.type === 'Silly Car :3 [1 in 10,000,000,000]' || rarity.type === 'Brainrot [1 in 50,000,000,000]' || rarity.type === 'Greg [1 in 500,000,000,000]' || rarity.type === 'Mintllie [1 in 5,000,000,000,000]' || rarity.type === 'Geezer [1 in 50,000,000,000,000]' || rarity.type === 'Polarr [1 in 500,000,000,000,000]') {
        // Hide result and change background to black
        document.getElementById("result").innerText = '';
        document.body.className = 'blackBg';
        const titleCont = document.querySelector('.container');
    
        titleCont.style.visibility = 'hidden';

        // Play appropriate audio
        if (rarity.type === 'Fright [1 in 1,075]') {
            frightAudio.play();
        } else if (rarity.type === 'Gargantua [1 in 143]') {
            gargantuaAudio.play();
        } else if (rarity.type === 'Oblivion [1 in 200]') {
            polarrSuspenceAudio.play();
        } else if (rarity.type === 'Sovereign [1 in 1,266]') {
            sovereignAudio.play();
        } else if (rarity.type === 'Surfer [???]') {
            polarrSuspenceAudio.play();
        } else if (rarity.type === 'Unnamed [1 in 13,889]') {
            unnamedAudio.play();
        } else if (rarity.type === 'Isekai [1 in 300]') {
            scareSuspenceAudio.play();
        } else if (rarity.type === 'Emergencies [1 in 500]') {
            scareSuspenceAudio.play();
        } else if (rarity.type === 'Samurai [1 in 800]') {
            scareSuspenceAudio.play();
        } else if (rarity.type === 'Contortions [1 in 999]') {
            scareSuspenceAudio.play();
        } else if (rarity.type === 'Impeached [1 in 101,010]') {
            impeachedAudio.play();
        } else if (rarity.type === '0pPre2s10N [GliTcH]') {
            oppSuspenceAudio.play();
        } else if (rarity.type === 'RNG Master [1 in 1,430,615]') {
            rngmasterAudio.play();
        } else if (rarity.type === 'Geezer [1 in 50,000,000,000,000]') {
            geezerSuspenceAudio.play();
            let geezerPopup = document.getElementById("geezerPopup");
            setTimeout(function (){
                geezerPopup.style.display = 'block';                                  
            }, 100);
            setTimeout(function (){
                geezerPopup.style.display = 'none';
            }, 400);
            setTimeout(function (){
                geezerPopup.style.display = 'block';                                 
            }, 700);
            setTimeout(function (){
                geezerPopup.style.display = 'none';
            }, 1000);
            setTimeout(function (){
                geezerPopup.style.display = 'block';                                 
            }, 1300);
            setTimeout(function (){
                geezerPopup.style.display = 'none';
            }, 1600);
            setTimeout(function (){
                geezerPopup.style.display = 'block';                                 
            }, 1900);
            setTimeout(function (){
                geezerPopup.style.display = 'none';
            }, 9000);
        } else if (rarity.type === 'Polarr [1 in 500,000,000,000,000]') {
            polarrSuspenceAudio.play();
        } else if (rarity.type === 'Greg [1 in 500,000,000,000]') {
            gregAudio.play();
        } else if (rarity.type == 'Silly Car :3 [1 in 10,000,000,000]') {
            silcarAudio.play();
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 100);
            setTimeout(function (){
                document.body.className = 'redBg';                                  
            }, 200);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 300);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 400);
            setTimeout(function (){
                document.body.className = 'redBg';                                  
            }, 500);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 600);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 700);
            setTimeout(function (){
                document.body.className = 'redBg';                                  
            }, 800);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 900);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 1000);
            setTimeout(function (){
                document.body.className = 'redBg';                                  
            }, 1100);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 1200);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 1300);
            setTimeout(function (){
                document.body.className = 'redBg';                                  
            }, 1400);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 1500);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 1600);
            setTimeout(function (){
                document.body.className = 'redBg';                                  
            }, 1700);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 1800);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 1900);
            setTimeout(function (){
                document.body.className = 'redBg';                                  
            }, 2000);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 2100);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 2200);
            setTimeout(function (){
                document.body.className = 'redBg';                                  
            }, 2300);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 2400);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 2500);
            setTimeout(function (){
                document.body.className = 'redBg';                                  
            }, 2600);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 2700);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 2800);
            setTimeout(function (){
                document.body.className = 'redBg';                                  
            }, 2900);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 3000);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 3100);
            setTimeout(function (){
                document.body.className = 'redBg';                                  
            }, 3200);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 3300);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 3400);
            setTimeout(function (){
                document.body.className = 'redBg';                                  
            }, 3500);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 3600);
            setTimeout(function (){
                document.body.className = 'blackBg';
            }, 3700);
            
        } else if (rarity.type === 'Mintllie [1 in 5,000,000,000,000]') {
            suspenseAudio.play();
            // Show warning popup
            let warningPopup = document.getElementById("warningPopup");
            setTimeout(function (){
                document.body.className = 'blackBg';
                warningPopup.style.display = 'block';                                  
            }, 100);
            setTimeout(function (){
                document.body.className = 'redBg';
                warningPopup.style.display = 'none';
            }, 300);
            setTimeout(function (){
                document.body.className = 'blackBg'; 
                warningPopup.style.display = 'block';                                 
            }, 400);
            setTimeout(function (){
                document.body.className = 'redBg';
                warningPopup.style.display = 'none';
            }, 600);
            setTimeout(function (){
                document.body.className = 'blackBg'; 
                warningPopup.style.display = 'block';                                 
            }, 700);
            setTimeout(function (){
                document.body.className = 'redBg';
                warningPopup.style.display = 'none';
            }, 900);
            setTimeout(function (){
                document.body.className = 'blackBg'; 
                warningPopup.style.display = 'block';                                 
            }, 1000);
            setTimeout(function (){
                document.body.className = 'redBg';
                warningPopup.style.display = 'none';
            }, 1200);
            setTimeout(function (){
                document.body.className = 'blackBg'; 
                warningPopup.style.display = 'block';                                 
            }, 1300);
            setTimeout(function (){
                document.body.className = 'redBg';
                warningPopup.style.display = 'none';
            }, 1500);
            setTimeout(function (){
                document.body.className = 'blackBg'; 
                warningPopup.style.display = 'block';                                 
            }, 1600);
            setTimeout(function (){
                document.body.className = 'redBg';
                warningPopup.style.display = 'none';
            }, 1800);
            setTimeout(function (){
                document.body.className = 'blackBg'; 
                warningPopup.style.display = 'block';                                 
            }, 1900);
            setTimeout(function (){
                document.body.className = 'redBg';
                warningPopup.style.display = 'none';
            }, 2100);
            setTimeout(function (){
                document.body.className = 'blackBg'; 
                warningPopup.style.display = 'block';                                 
            }, 2200);
            setTimeout(function (){
                document.body.className = 'redBg';
                warningPopup.style.display = 'none';
            }, 2400);
            setTimeout(function (){
                document.body.className = 'blackBg'; 
                warningPopup.style.display = 'block';                                 
            }, 2500);
            setTimeout(function (){
                document.body.className = 'redBg';
                warningPopup.style.display = 'none';
            }, 2700);
            setTimeout(function (){
                document.body.className = 'blackBg'; 
                warningPopup.style.display = 'block';                                 
            }, 2800);
            setTimeout(function (){
                document.body.className = 'redBg';
                warningPopup.style.display = 'none';
            }, 3000);
            setTimeout(function (){
                document.body.className = 'blackBg'; 
                warningPopup.style.display = 'block';                                 
            }, 3100);
            setTimeout(function (){
                document.body.className = 'redBg';
                warningPopup.style.display = 'none';
            }, 3300);
            setTimeout(function (){
                document.body.className = 'blackBg'; 
                warningPopup.style.display = 'block';                                 
            }, 3400);
            setTimeout(function (){
                document.body.className = 'redBg';
                warningPopup.style.display = 'none';
            }, 3600);
            setTimeout(function (){
                document.body.className = 'blackBg';
                warningPopup.style.display = 'block';
                suspenseAudio.play();
                
                warningPopup.style.display = 'none';
            }, 3700);
        } else {
            suspenseAudio.play();
        }

        if (rarity.type === 'Impeached [1 in 101,010]' || rarity.type === 'Greg [1 in 500,000,000,000]') {
            disableChange();
            startAnimation1();
            const container = document.getElementById('starContainer');

            for (let i = 0; i < 33; i++) {
                const star = document.createElement('span');
                star.className = 'pink-star';
                star.innerHTML = '⁜';
            
                // Randomize the horizontal position
                star.style.left = Math.random() * 100 + 'vw';
            
                // Randomize the horizontal movement during the levitation
                const randomX = (Math.random() - 0.25) * 20 + 'vw'; // range: -10vw to 10vw
                star.style.setProperty('--randomX', randomX);
            
                // Randomize the rotation
                const randomRotation = (Math.random() - 0.5) * 720 + 'deg'; // range: -180deg to 180deg
                star.style.setProperty('--randomRotation', randomRotation);
            
                // Randomize the animation delay for each star
                star.style.animationDelay = i * 0.08 + 's';
            
                container.appendChild(star);
            
                // Remove the star after animation ends to clean up the DOM
                star.addEventListener('animationend', () => {
                    star.remove();
                });
            }
            setTimeout(() => {
                document.body.className = 'whiteFlash';
                setTimeout(() => {
                    document.body.className = rarity.class;
                    addToInventory(title, rarity.class);
                    displayResult(title, rarity.type);
                    changeBackground(rarity.class);
                    rollButton.disabled = false;
                    rollCount++;
                    titleCont.style.visibility = 'visible';
                }, 100); // Short white flash
                enableChange();
            }, 3000); // Wait for 3 seconds

        } else if (rarity.type === 'Gargantua [1 in 143]') {
            disableChange();
            startAnimation();
            const container = document.getElementById('starContainer');

            for (let i = 0; i < 69; i++) {
                const star = document.createElement('span');
                star.className = 'blue-star';
                star.innerHTML = '⁙';
            
                // Randomize the horizontal position
                star.style.left = Math.random() * 100 + 'vw';
            
                // Randomize the horizontal movement during the levitation
                const randomX = (Math.random() - 0.25) * 20 + 'vw'; // range: -10vw to 10vw
                star.style.setProperty('--randomX', randomX);
            
                // Randomize the rotation
                const randomRotation = (Math.random() - 0.5) * 720 + 'deg'; // range: -180deg to 180deg
                star.style.setProperty('--randomRotation', randomRotation);
            
                // Randomize the animation delay for each star
                star.style.animationDelay = i * 0.08 + 's';
            
                container.appendChild(star);
            
                // Remove the star after animation ends to clean up the DOM
                star.addEventListener('animationend', () => {
                    star.remove();
                });
            }
            setTimeout(function (){
                document.body.className = 'whiteFlash';                             
            }, 4000);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 6000);
            setTimeout(() => {
                document.body.className = 'whiteFlash';
                setTimeout(() => {
                    document.body.className = rarity.class;
                    addToInventory(title, rarity.class);
                    displayResult(title, rarity.type);
                    changeBackground(rarity.class);
                    rollButton.disabled = false;
                    rollCount++;
                    titleCont.style.visibility = 'visible';
                }, 100); // Short white flash
                enableChange();
            }, 7000); // Wait for 7 seconds

        } else if (rarity.type === 'Oblivion [1 in 200]') {
            disableChange();
            startAnimation3();
            const container = document.getElementById('starContainer');

            for (let i = 0; i < 133; i++) {
                const star = document.createElement('span');
                star.className = 'purple-star';
                star.innerHTML = '※';
            
                // Randomize the horizontal position
                star.style.left = Math.random() * 100 + 'vw';
            
                // Randomize the horizontal movement during the levitation
                const randomX = (Math.random() - 0.25) * 20 + 'vw'; // range: -10vw to 10vw
                star.style.setProperty('--randomX', randomX);
            
                // Randomize the rotation
                const randomRotation = (Math.random() - 0.5) * 720 + 'deg'; // range: -180deg to 180deg
                star.style.setProperty('--randomRotation', randomRotation);
            
                // Randomize the animation delay for each star
                star.style.animationDelay = i * 0.08 + 's';
            
                container.appendChild(star);
            
                // Remove the star after animation ends to clean up the DOM
                star.addEventListener('animationend', () => {
                    star.remove();
                });
            }
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 8000);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 10000);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 10500);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 11000);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 11500);
            setTimeout(() => {
                document.body.className = 'whiteFlash';
                setTimeout(() => {
                    document.body.className = rarity.class;
                    addToInventory(title, rarity.class);
                    displayResult(title, rarity.type);
                    changeBackground(rarity.class);
                    rollButton.disabled = false;
                    rollCount++;
                    titleCont.style.visibility = 'visible';
                    oblAudio.play();
                }, 100); // Short white flash
                enableChange();
            }, 12000); // Wait for 12 seconds

        } else if (rarity.type === 'Isekai [1 in 300]') {
            disableChange();
            startAnimation1();
            const container = document.getElementById('starContainer');

            for (let i = 0; i < 33; i++) {
                const star = document.createElement('span');
                star.className = 'green-star';
                star.innerHTML = '⁂';
            
                // Randomize the horizontal position
                star.style.left = Math.random() * 100 + 'vw';
            
                // Randomize the horizontal movement during the levitation
                const randomX = (Math.random() - 0.25) * 20 + 'vw'; // range: -10vw to 10vw
                star.style.setProperty('--randomX', randomX);
            
                // Randomize the rotation
                const randomRotation = (Math.random() - 0.5) * 720 + 'deg'; // range: -180deg to 180deg
                star.style.setProperty('--randomRotation', randomRotation);
            
                // Randomize the animation delay for each star
                star.style.animationDelay = i * 0.08 + 's';
            
                container.appendChild(star);
            
                // Remove the star after animation ends to clean up the DOM
                star.addEventListener('animationend', () => {
                    star.remove();
                });
            }
            setTimeout(() => {
                document.body.className = 'whiteFlash';
                setTimeout(() => {
                    document.body.className = rarity.class;
                    addToInventory(title, rarity.class);
                    displayResult(title, rarity.type);
                    changeBackground(rarity.class);
                    rollButton.disabled = false;
                    rollCount++;
                    titleCont.style.visibility = 'visible';
                    isekaiAudio.play();
                }, 100); // Short white flash
                enableChange();
            }, 3000); // Wait for 3 seconds

        } else if (rarity.type === 'Emergencies [1 in 500]') {
            disableChange();
            startAnimation1();
            const container = document.getElementById('starContainer');

            for (let i = 0; i < 33; i++) {
                const star = document.createElement('span');
                star.className = 'green-star';
                star.innerHTML = '⌖';
            
                // Randomize the horizontal position
                star.style.left = Math.random() * 100 + 'vw';
            
                // Randomize the horizontal movement during the levitation
                const randomX = (Math.random() - 0.25) * 20 + 'vw'; // range: -10vw to 10vw
                star.style.setProperty('--randomX', randomX);
            
                // Randomize the rotation
                const randomRotation = (Math.random() - 0.5) * 720 + 'deg'; // range: -180deg to 180deg
                star.style.setProperty('--randomRotation', randomRotation);
            
                // Randomize the animation delay for each star
                star.style.animationDelay = i * 0.08 + 's';
            
                container.appendChild(star);
            
                // Remove the star after animation ends to clean up the DOM
                star.addEventListener('animationend', () => {
                    star.remove();
                });
            }
            setTimeout(() => {
                document.body.className = 'whiteFlash';
                setTimeout(() => {
                    document.body.className = rarity.class;
                    addToInventory(title, rarity.class);
                    displayResult(title, rarity.type);
                    changeBackground(rarity.class);
                    rollButton.disabled = false;
                    rollCount++;
                    titleCont.style.visibility = 'visible';
                    emerAudio.play();
                }, 100); // Short white flash
                enableChange();
            }, 3000); // Wait for 3 seconds

        } else if (rarity.type === 'Samurai [1 in 800]') {
            disableChange();
            startAnimation1();
            const container = document.getElementById('starContainer');

            for (let i = 0; i < 33; i++) {
                const star = document.createElement('span');
                star.className = 'green-star';
                star.innerHTML = '⨁';
            
                // Randomize the horizontal position
                star.style.left = Math.random() * 100 + 'vw';
            
                // Randomize the horizontal movement during the levitation
                const randomX = (Math.random() - 0.25) * 20 + 'vw'; // range: -10vw to 10vw
                star.style.setProperty('--randomX', randomX);
            
                // Randomize the rotation
                const randomRotation = (Math.random() - 0.5) * 720 + 'deg'; // range: -180deg to 180deg
                star.style.setProperty('--randomRotation', randomRotation);
            
                // Randomize the animation delay for each star
                star.style.animationDelay = i * 0.08 + 's';
            
                container.appendChild(star);
            
                // Remove the star after animation ends to clean up the DOM
                star.addEventListener('animationend', () => {
                    star.remove();
                });
            }
            setTimeout(() => {
                document.body.className = 'whiteFlash';
                setTimeout(() => {
                    document.body.className = rarity.class;
                    addToInventory(title, rarity.class);
                    displayResult(title, rarity.type);
                    changeBackground(rarity.class);
                    rollButton.disabled = false;
                    rollCount++;
                    titleCont.style.visibility = 'visible';
                    samuraiAudio.play();
                }, 100); // Short white flash
                enableChange();
            }, 3000); // Wait for 3 seconds

        } else if (rarity.type === 'Contortions [1 in 999]') {
            disableChange();
            startAnimation1();
            const container = document.getElementById('starContainer');

            for (let i = 0; i < 33; i++) {
                const star = document.createElement('span');
                star.className = 'green-star';
                star.innerHTML = '⨳';
            
                // Randomize the horizontal position
                star.style.left = Math.random() * 100 + 'vw';
            
                // Randomize the horizontal movement during the levitation
                const randomX = (Math.random() - 0.25) * 20 + 'vw'; // range: -10vw to 10vw
                star.style.setProperty('--randomX', randomX);
            
                // Randomize the rotation
                const randomRotation = (Math.random() - 0.5) * 720 + 'deg'; // range: -180deg to 180deg
                star.style.setProperty('--randomRotation', randomRotation);
            
                // Randomize the animation delay for each star
                star.style.animationDelay = i * 0.08 + 's';
            
                container.appendChild(star);
            
                // Remove the star after animation ends to clean up the DOM
                star.addEventListener('animationend', () => {
                    star.remove();
                });
            }
            setTimeout(() => {
                document.body.className = 'whiteFlash';
                setTimeout(() => {
                    document.body.className = rarity.class;
                    addToInventory(title, rarity.class);
                    displayResult(title, rarity.type);
                    changeBackground(rarity.class);
                    rollButton.disabled = false;
                    rollCount++;
                    titleCont.style.visibility = 'visible';
                    contAudio.play();
                }, 100); // Short white flash
                enableChange();
            }, 3000); // Wait for 3 seconds

        } else if (rarity.type === 'Fright [1 in 1,075]') {
            disableChange();
            startAnimation4();
            const container = document.getElementById('starContainer');

            for (let i = 0; i < 200; i++) {
                const star = document.createElement('span');
                star.className = 'dark-red-star';
                star.innerHTML = '⨹';
            
                // Randomize the horizontal position
                star.style.left = Math.random() * 100 + 'vw';
            
                // Randomize the horizontal movement during the levitation
                const randomX = (Math.random() - 0.25) * 20 + 'vw'; // range: -10vw to 10vw
                star.style.setProperty('--randomX', randomX);
            
                // Randomize the rotation
                const randomRotation = (Math.random() - 0.5) * 720 + 'deg'; // range: -180deg to 180deg
                star.style.setProperty('--randomRotation', randomRotation);
            
                // Randomize the animation delay for each star
                star.style.animationDelay = i * 0.08 + 's';
            
                container.appendChild(star);
            
                // Remove the star after animation ends to clean up the DOM
                star.addEventListener('animationend', () => {
                    star.remove();
                });
            }
            setTimeout(() => {
                document.body.className = 'whiteFlash';
                setTimeout(() => {
                    document.body.className = rarity.class;
                    addToInventory(title, rarity.class);
                    displayResult(title, rarity.type);
                    changeBackground(rarity.class);
                    rollButton.disabled = false;
                    rollCount++;
                    titleCont.style.visibility = 'visible';
                }, 100); // Short white flash
                enableChange();
            }, 27400); // Wait for 27.4 seconds

        } else if (rarity.type === 'Unnamed [1 in 13,889]') {
            disableChange();
            startAnimation5();
            const container = document.getElementById('starContainer');

            for (let i = 0; i < 190; i++) {
                const star = document.createElement('span');
                star.className = 'pink-star';
                star.innerHTML = 'Brage';
            
                // Randomize the horizontal position
                star.style.left = Math.random() * 100 + 'vw';
            
                // Randomize the horizontal movement during the levitation
                const randomX = (Math.random() - 0.25) * 20 + 'vw'; // range: -10vw to 10vw
                star.style.setProperty('--randomX', randomX);
            
                // Randomize the rotation
                const randomRotation = (Math.random() - 0.5) * 720 + 'deg'; // range: -180deg to 180deg
                star.style.setProperty('--randomRotation', randomRotation);
            
                // Randomize the animation delay for each star
                star.style.animationDelay = i * 0.08 + 's';
            
                container.appendChild(star);
            
                // Remove the star after animation ends to clean up the DOM
                star.addEventListener('animationend', () => {
                    star.remove();
                });
            }

            for (let i = 0; i < 190; i++) {
                const star = document.createElement('span');
                star.className = 'red-star';
                star.innerHTML = '?????';
            
                // Randomize the horizontal position
                star.style.left = Math.random() * 100 + 'vw';
            
                // Randomize the horizontal movement during the levitation
                const randomX = (Math.random() - 0.25) * 20 + 'vw'; // range: -10vw to 10vw
                star.style.setProperty('--randomX', randomX);
            
                // Randomize the rotation
                const randomRotation = (Math.random() - 0.5) * 720 + 'deg'; // range: -180deg to 180deg
                star.style.setProperty('--randomRotation', randomRotation);
            
                // Randomize the animation delay for each star
                star.style.animationDelay = i * 0.08 + 's';
            
                container.appendChild(star);
            
                // Remove the star after animation ends to clean up the DOM
                star.addEventListener('animationend', () => {
                    star.remove();
                });
            }
            setTimeout(() => {
                document.body.className = 'whiteFlash';
                setTimeout(() => {
                    document.body.className = rarity.class;
                    addToInventory(title, rarity.class);
                    displayResult(title, rarity.type);
                    changeBackground(rarity.class);
                    rollButton.disabled = false;
                    rollCount++;
                    titleCont.style.visibility = 'visible';
                }, 100); // Short white flash
                enableChange();
            }, 17400); // Wait for 17.4 seconds

        } else if (rarity.type === 'RNG Master [1 in 1,430,615]') {
            disableChange();
            startAnimation6();
            const container = document.getElementById('starContainer');

            for (let i = 0; i < 170; i++) {
                const star = document.createElement('span');
                star.className = 'purple-star';
                star.innerHTML = '※';
            
                // Randomize the horizontal position
                star.style.left = Math.random() * 100 + 'vw';
            
                // Randomize the horizontal movement during the levitation
                const randomX = (Math.random() - 0.25) * 20 + 'vw'; // range: -10vw to 10vw
                star.style.setProperty('--randomX', randomX);
            
                // Randomize the rotation
                const randomRotation = (Math.random() - 0.5) * 720 + 'deg'; // range: -180deg to 180deg
                star.style.setProperty('--randomRotation', randomRotation);
            
                // Randomize the animation delay for each star
                star.style.animationDelay = i * 0.08 + 's';
            
                container.appendChild(star);
            
                // Remove the star after animation ends to clean up the DOM
                star.addEventListener('animationend', () => {
                    star.remove();
                });
            }

            for (let i = 0; i < 170; i++) {
                const star = document.createElement('span');
                star.className = 'pink-star';
                star.innerHTML = '※';
            
                // Randomize the horizontal position
                star.style.left = Math.random() * 100 + 'vw';
            
                // Randomize the horizontal movement during the levitation
                const randomX = (Math.random() - 0.25) * 20 + 'vw'; // range: -10vw to 10vw
                star.style.setProperty('--randomX', randomX);
            
                // Randomize the rotation
                const randomRotation = (Math.random() - 0.5) * 720 + 'deg'; // range: -180deg to 180deg
                star.style.setProperty('--randomRotation', randomRotation);
            
                // Randomize the animation delay for each star
                star.style.animationDelay = i * 0.08 + 's';
            
                container.appendChild(star);
            
                // Remove the star after animation ends to clean up the DOM
                star.addEventListener('animationend', () => {
                    star.remove();
                });
            }

            for (let i = 0; i < 170; i++) {
                const star = document.createElement('span');
                star.className = 'red-star';
                star.innerHTML = '※';
            
                // Randomize the horizontal position
                star.style.left = Math.random() * 100 + 'vw';
            
                // Randomize the horizontal movement during the levitation
                const randomX = (Math.random() - 0.25) * 20 + 'vw'; // range: -10vw to 10vw
                star.style.setProperty('--randomX', randomX);
            
                // Randomize the rotation
                const randomRotation = (Math.random() - 0.5) * 720 + 'deg'; // range: -180deg to 180deg
                star.style.setProperty('--randomRotation', randomRotation);
            
                // Randomize the animation delay for each star
                star.style.animationDelay = i * 0.08 + 's';
            
                container.appendChild(star);
            
                // Remove the star after animation ends to clean up the DOM
                star.addEventListener('animationend', () => {
                    star.remove();
                });
            }
            setTimeout(() => {
                document.body.className = 'whiteFlash';
                setTimeout(() => {
                    document.body.className = rarity.class;
                    addToInventory(title, rarity.class);
                    displayResult(title, rarity.type);
                    changeBackground(rarity.class);
                    rollButton.disabled = false;
                    rollCount++;
                    titleCont.style.visibility = 'visible';
                }, 100); // Short white flash
                enableChange();
            }, 14500); // Wait for 14.5 seconds

        } else if (rarity.type === 'Sovereign [1 in 1,266]') {
            disableChange();
            startAnimation3();
            const container = document.getElementById('starContainer');

            for (let i = 0; i < 133; i++) {
                const star = document.createElement('span');
                star.className = 'peach-star';
                star.innerHTML = '⁛';
            
                // Randomize the horizontal position
                star.style.left = Math.random() * 100 + 'vw';
            
                // Randomize the horizontal movement during the levitation
                const randomX = (Math.random() - 0.25) * 20 + 'vw'; // range: -10vw to 10vw
                star.style.setProperty('--randomX', randomX);
            
                // Randomize the rotation
                const randomRotation = (Math.random() - 0.5) * 720 + 'deg'; // range: -180deg to 180deg
                star.style.setProperty('--randomRotation', randomRotation);
            
                // Randomize the animation delay for each star
                star.style.animationDelay = i * 0.08 + 's';
            
                container.appendChild(star);
            
                // Remove the star after animation ends to clean up the DOM
                star.addEventListener('animationend', () => {
                    star.remove();
                });
            }
            setTimeout(() => {
                document.body.className = 'whiteFlash';
                setTimeout(() => {
                    document.body.className = rarity.class;
                    addToInventory(title, rarity.class);
                    displayResult(title, rarity.type);
                    changeBackground(rarity.class);
                    rollButton.disabled = false;
                    rollCount++;
                    titleCont.style.visibility = 'visible';
                }, 100); // Short white flash
                enableChange();
            }, 11300); // Wait for 11.3 seconds

        } else if (rarity.type === 'Surfer [???]') {
            disableChange();
            startAnimation3();
            const container = document.getElementById('starContainer');

            for (let i = 0; i < 133; i++) {
                const star = document.createElement('span');
                star.className = 'blue-star';
                star.innerHTML = 'Williamo';
            
                // Randomize the horizontal position
                star.style.left = Math.random() * 100 + 'vw';
            
                // Randomize the horizontal movement during the levitation
                const randomX = (Math.random() - 0.25) * 20 + 'vw'; // range: -10vw to 10vw
                star.style.setProperty('--randomX', randomX);
            
                // Randomize the rotation
                const randomRotation = (Math.random() - 0.5) * 720 + 'deg'; // range: -180deg to 180deg
                star.style.setProperty('--randomRotation', randomRotation);
            
                // Randomize the animation delay for each star
                star.style.animationDelay = i * 0.08 + 's';
            
                container.appendChild(star);
            
                // Remove the star after animation ends to clean up the DOM
                star.addEventListener('animationend', () => {
                    star.remove();
                });
            }

            for (let i = 0; i < 133; i++) {
                const star = document.createElement('span');
                star.className = 'peach-star';
                star.innerHTML = '⁕';
            
                // Randomize the horizontal position
                star.style.left = Math.random() * 100 + 'vw';
            
                // Randomize the horizontal movement during the levitation
                const randomX = (Math.random() - 0.25) * 20 + 'vw'; // range: -10vw to 10vw
                star.style.setProperty('--randomX', randomX);
            
                // Randomize the rotation
                const randomRotation = (Math.random() - 0.5) * 720 + 'deg'; // range: -180deg to 180deg
                star.style.setProperty('--randomRotation', randomRotation);
            
                // Randomize the animation delay for each star
                star.style.animationDelay = i * 0.08 + 's';
            
                container.appendChild(star);
            
                // Remove the star after animation ends to clean up the DOM
                star.addEventListener('animationend', () => {
                    star.remove();
                });
            }
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 8000);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 10000);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 10500);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 11000);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 11500);
            setTimeout(() => {
                document.body.className = 'whiteFlash';
                setTimeout(() => {
                    document.body.className = rarity.class;
                    addToInventory(title, rarity.class);
                    displayResult(title, rarity.type);
                    changeBackground(rarity.class);
                    rollButton.disabled = false;
                    rollCount++;
                    titleCont.style.visibility = 'visible';
                    surferAudio.play();
                }, 100); // Short white flash
                enableChange();
            }, 12000); // Wait for 12 seconds

        } else if (rarity.type === 'Geezer [1 in 50,000,000,000,000]') {
            disableChange();
            setTimeout(() => {
                document.body.className = 'whiteFlash';
                setTimeout(() => {
                    document.body.className = rarity.class;
                    addToInventory(title, rarity.class);
                    displayResult(title, rarity.type);
                    changeBackground(rarity.class);
                    rollButton.disabled = false;
                    rollCount++;
                    geezerAudio.play();
                    setTimeout(() => {
                        titleCont.style.visibility = 'visible';
                    }, 86400000);
                }, 100); // Short white flash
                enableChange();
            }, 9000); // Wait for 9 seconds

        } else if (rarity.type === 'Polarr [1 in 500,000,000,000,000]') {
            disableChange();
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 10000);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 10500);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 11000);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 11500);
            setTimeout(() => {
                document.body.className = 'whiteFlash';
                setTimeout(() => {
                    document.body.className = rarity.class;
                    addToInventory(title, rarity.class);
                    displayResult(title, rarity.type);
                    changeBackground(rarity.class);
                    rollButton.disabled = false;
                    rollCount++;
                    titleCont.style.visibility = 'visible';
                    polarrAudio.play();
                }, 100); // Short white flash
                enableChange();
            }, 12000); // Wait for 12 seconds

        } else if (rarity.type === '0pPre2s10N [GliTcH]') {
            disableChange();
            startAnimation8();
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 1000);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 1500);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 2000);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 2500);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 3000);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 3500);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 4000);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 4350);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 4650);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 4900);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 5200);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 5400);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 5600);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 5800);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 6000);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 6200);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 6400);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 6500);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 6600);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 6700);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 6800);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 6900);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 7000);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 7100);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 7200);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 7300);
            setTimeout(function (){
                document.body.className = 'whiteFlash';                                  
            }, 7400);
            setTimeout(function (){
                document.body.className = 'blackBg';                                  
            }, 7500);
            setTimeout(() => {
                document.body.className = 'whiteFlash';
                setTimeout(() => {
                    document.body.className = rarity.class;
                    addToInventory(title, rarity.class);
                    displayResult(title, rarity.type);
                    changeBackground(rarity.class);
                    rollButton.disabled = false;
                    rollCount++;
                    titleCont.style.visibility = 'visible';
                    oppAudio.play();
                }, 100); // Short white flash
                enableChange();
            }, 7800); // Wait for 7.8 seconds

        } else if (rarity.type === 'Unstoppable [1 in 112]' || rarity.type === 'English or Spanish [1 in 25,641]' || rarity.type === 'Overture [1 in 25,641]' || rarity.type === 'Silly Car :3 [1 in 10,000,000,000]' || rarity.type === 'Brainrot [1 in 50,000,000,000]' || rarity.type === 'Greg [1 in 500,000,000,000]' || rarity.type === 'Mintllie [1 in 5,000,000,000,000]') {
            disableChange();
            startAnimation7();
            const container = document.getElementById('starContainer');

            for (let i = 0; i < 44; i++) {
                const star = document.createElement('span');
                star.className = 'white-star';
                star.innerHTML = '▫️';
            
                // Randomize the horizontal position
                star.style.left = Math.random() * 100 + 'vw';
            
                // Randomize the horizontal movement during the levitation
                const randomX = (Math.random() - 0.25) * 20 + 'vw'; // range: -10vw to 10vw
                star.style.setProperty('--randomX', randomX);
            
                // Randomize the rotation
                const randomRotation = (Math.random() - 0.5) * 720 + 'deg'; // range: -180deg to 180deg
                star.style.setProperty('--randomRotation', randomRotation);
            
                // Randomize the animation delay for each star
                star.style.animationDelay = i * 0.08 + 's';
            
                container.appendChild(star);
            
                // Remove the star after animation ends to clean up the DOM
                star.addEventListener('animationend', () => {
                    star.remove();
                });
            }
            setTimeout(() => {
                document.body.className = 'whiteFlash';

                if (rarity.type === 'Unstoppable [1 in 112]') {
                    unstoppableAudio.play();
                }
                if (rarity.type === 'English or Spanish [1 in 34,483]') {
                    engorspaAudio.play();
                }
                if (rarity.type === 'Overture [1 in 344,828]') {
                    overtureAudio.play();
                }
                if (rarity.type === 'Brainrot [1 in 100,000,000,000]') {
                    brainrotAudio.play();
                }
                if (rarity.type === 'Mintllie [1 in 10,000,000,000,000]') {
                    mintllieAudio.play();
                }
                
                setTimeout(() => {
                    document.body.className = rarity.class;
                    addToInventory(title, rarity.class);
                    displayResult(title, rarity.type);
                    changeBackground(rarity.class);
                    rollButton.disabled = false;
                    titleCont.style.visibility = 'visible';
                }, 100); // Short white flash
                enableChange();
            }, 4400); // Wait for 4.4 seconds
        }
    } else {
        addToInventory(title, rarity.class);
        displayResult(title, rarity.type);
        changeBackground(rarity.class);
        rollCount++;
        setTimeout(() => {
            rollButton.disabled = false;
        }, 690);
    }
    localStorage.setItem('rollCount', rollCount);
    load();
});

function rollRarity() {
    const rarities = [
        { type: 'Common [1 in 2.5]', class: 'commonBgImg', chance: 40, titles: ['Good', 'Natural', 'Simple', 'Basic', 'Plain', 'Average', 'Ordinary', 'Usual', 'Regular', 'Standard'] },
        { type: 'Rare [1 in 4]', class: 'rareBgImg', chance: 26.5, titles: ['Divine', 'Crystallized', 'Radiant', 'Gleaming', 'Shimmering', 'Glowing', 'Luminous', 'Brilliant', 'Sparkling', 'Dazzling'] },
        { type: 'Epic [1 in 5]', class: 'epicBgImg', chance: 18.34, titles: ['Mythic', 'Enchanted', 'Majestic', 'Regal', 'Heroic', 'Noble', 'Exalted', 'Fabled', 'Exotic', 'Glorious'] },
        { type: 'Legendary [1 in 13]', class: 'legendaryBgImg', chance: 7.5, titles: ['Immortal', 'Celestial', 'Eternal', 'Transcendent', 'Supreme', 'Bounded', 'Omniscient', 'Omnipotent', 'Ultimate', 'Apex'] },
        { type: 'Impossible [1 in 20]', class: 'impossibleBgImg', chance: 5, titles: ['Fantastical', 'Unbelievable', 'Miraculous', 'Extraordinary', 'Astounding', 'Phenomenal', 'Inconceivable', 'Unimaginable', 'Supernatural', 'Paranormal'] },
        { type: 'Powered [1 in 40]', class: 'poweredBgImg', chance: 2.5, titles: ['Undead', 'Sidereum', 'Glock', 'Wind', 'Lunar', 'Solar', 'Hazard', 'Shattered', 'Alien', 'Veil'] },
        { type: 'Solarpower [1 in 67]', class: 'solarpowerBgImg', chance: 1.5, titles: ['Hazard: Rays', 'Ink: Leak', 'Shattered: Beginning', 'Alien: Abduction', 'Veil: Nebula', 'Nautilus', 'Precious', 'Glacier', 'Bleeding', 'Ink'] },
        { type: 'Unstoppable [1 in 112]', class: 'unstoppableBgImg', chance: 0.8941045669, titles: ['Invincible', 'Unyielding', 'Indomitable', 'Unbreakable', 'Irresistible', 'Unconquerable', 'Chromatic: Genesis', 'Chromatic: Exotic', 'Chromatic', 'Untouchable'] },
        { type: 'Gargantua [1 in 143]', class: 'gargBgImg', chance: 0.699, titles: ['Colossal', 'Titanic', 'Monumental', 'Gigantic', 'Mammoth', 'Immense', 'Enormous', 'Vast', 'Behemoth', 'Leviathan'] },
        { type: 'Oblivion [1 in 200]', class: 'oblBgImg', chance: 0.499, titles: ['The Truth Seeker', 'Memory'] },
        { type: 'Isekai [1 in 300]', class: 'isekaiBgImg', chance: 0.333333333, titles: ['Otherworldly', 'Transported', 'Duality: Konosuba', 'Immersive: Re:Zero', 'Immersive', 'Otherworldly: No Game No Life', 'Protagonist', 'Summoning', 'Fantasyland', 'Duality'] },
        { type: 'Emergencies [1 in 500]', class: 'emerBgImg', chance: 0.2, titles: ['Urgent', 'Crisis', 'Crisis: Earthquake', 'Danger: Fire', 'Immediate', 'Alert: Flood', 'Rescue', 'Alert', 'Danger', 'Response'] },
        { type: 'Samurai [1 in 800]', class: 'samuraiBgImg', chance: 0.125, titles: ['Warrior', 'Bushido', 'Martial: Katana', 'Feudal: Ronin', 'Honor', 'Honor: Shogun', 'Feudal', 'Martial', 'Loyalty', 'Tradition'] },
        { type: 'Contortions [1 in 999]', class: 'contBgImg', chance: 0.1001001001, titles: ['Flexibility', 'Twisting', 'Bending: Acrobatics', 'Agility: Gymnastics', 'Elasticity', 'Contorting: Movability', 'Bending', 'Stretching', 'Agility', 'Contorting']        },
        { type: 'Fright [1 in 1,075]', class: 'frightBgImg', chance: 0.093, titles: ['Dark', 'Dark: Terror', 'Beast', 'Beast: Unhinged', 'Dark: Pure Fear'] },
        { type: 'Sovereign [1 in 1,266]', class: 'sovereignBgImg', chance: 0.079, titles: ['Twilight: Iridescent Memory', 'Glitch', 'Arcane: Dark', 'Exotic: Apex', 'Ethereal', 'Stormal: Hurricane', 'Matrix', 'Arcane: Legacy', 'Starscourge', 'Sailor: Flying Dutchman'] },
        { type: 'English or Spanish [1 in 25,641]', class: 'engorspaBgImg', chance: 0.0039, titles: ['The first one who moves is gay...'] },
        { type: 'Unnamed [1 in 13,889]', class: 'unnamedBgImg', chance: 0.0072, titles: ['Undefined: Name'] },
        { type: 'Overture [1 in 25,641]', class: 'overtureBgImg', chance: 0.0039, titles: ['Lightspeed', 'Sky: The limit', 'Arcane: Light', 'Immense: Tarnished', 'Vast: Electro', 'Cloudpoint', 'Glory', 'Lord: History', 'Starlight', 'Momentum'] },
        { type: 'Impeached [1 in 101,010]', class: 'impeachedBgImg', chance: 0.00099, titles: ['Bloodlust', 'Starscourge: Radiant, Symphony', 'Bleeding: The Secret of Common', 'Diaboli: The Secret of Divinus', 'Surge: Infinity Overlord'] },
        { type: 'RNG Master [1 in 1,430,615]', class: 'rngmasterBgImg', chance: 0.0000699, titles: ['RNG: Master of All Masters'] },
        { type: 'Silly Car :3 [1 in 10,000,000,000]', class: 'silcarBgImg', chance: 0.00000001, titles: ['Vrom: Vrom'] },
        { type: 'Brainrot [1 in 50,000,000,000]', class: 'brainrotBgImg', chance: 0.000000002, titles: ['Skibidi', 'Skibidi: Toilet', 'Gyatt', 'Rizzler', 'SUS', 'SUS: Amogus', 'Edge', 'Edge: Gyatt Rizzler'] },
        { type: 'Greg [1 in 500,000,000,000]', class: 'gregBgImg', chance: 0.0000000002, titles: ['Greg'] },
        { type: 'Mintllie [1 in 5,000,000,000,000]', class: 'mintllieBgImg', chance: 0.00000000002, titles: ['Mintllie'] },
        { type: 'Geezer [1 in 50,000,000,000,000]', class: 'geezerBgGif', chance: 0.000000000002, titles: ['Geezer'] },
        { type: 'Polarr [1 in 500,000,000,000,000]', class: 'polarrBgImg', chance: 0.0000000000002, titles: ['POLARR'] },
        { type: 'Surfer [???]', class: 'surferBgImg', chance: 0.00433333333333333333333333, titles: ['Waves'] },
        { type: '0pPre2s10N [GliTcH]', class: 'oppBgImg', chance: 0.002, titles: ['Shattered: Heart'] },
    ];

    let randomNum = Math.random() * 150;
    let cumulativeChance = 0;

    for (let i = 0; i < rarities.length; i++) {
        cumulativeChance += rarities[i].chance;
        if (randomNum <= cumulativeChance) {
            return rarities[i];
        }
    }

    return rarities[0]; // Default to Common if no match found
}

function clickSound() {
    let click = document.getElementById("click");
    var audio = document.getElementById('mainAudio');
    var fadeOutDuration = 2000; // Duration of fade-out in milliseconds
    var interval = 50; // Interval for updating volume
    var volumeStep = interval / fadeOutDuration; // Volume decrease step
    var currentVolume = audio.volume;

    function fadeOut() {
        if (currentVolume > 0) {
            currentVolume -= volumeStep;
            if (currentVolume < 0) currentVolume = 0;
            audio.volume = currentVolume;
            setTimeout(fadeOut, interval);
        } else {
            audio.pause(); // Stop the audio after fade-out
        }
    }

    fadeOut();

    click.play();

    // Add event listener to the button
    document.getElementById('rollButton').addEventListener('click', clickSound);
}

function unnamedUser() {
    var copyText = document.getElementById("unnamedUser");
    copyText.hidden = false;
    copyText.select();
    document.execCommand("copy");
    copyText.hidden = true;
    alert("Copied selected discord user: " + copyText.value);
}

function geezerUser() {
    var copyText = document.getElementById("geezerUser");
    copyText.hidden = false;
    copyText.select();
    document.execCommand("copy");
    copyText.hidden = true;
    alert("Copied selected discord user: " + copyText.value);
}

function blodhestUser() {
    var copyText = document.getElementById("blodhestUser");
    copyText.hidden = false;
    copyText.select();
    document.execCommand("copy");
    copyText.hidden = true;
    alert("Copied selected discord user: " + copyText.value);
}

function mintllieUser() {
    var copyText = document.getElementById("mintllieUser");
    copyText.hidden = false;
    copyText.select();
    document.execCommand("copy");
    copyText.hidden = true;
    alert("Copied selected discord user: " + copyText.value);
}

function dxrkUser() {
    var copyText = document.getElementById("dxrkUser");
    copyText.hidden = false;
    copyText.select();
    document.execCommand("copy");
    copyText.hidden = true;
    alert("Copied selected discord user: " + copyText.value);
}

function selectTitle(rarity) {
    const titles = rarity.titles;
    return titles[Math.floor(Math.random() * titles.length)];
}

function displayResult(title, rarity) {
    const resultDiv = document.getElementById("result");
    resultDiv.innerText = `You rolled a ${rarity}
    Item: ${title}!`;
}

function changeBackground(rarityClass) {
    const body = document.body;
    body.className = '';
    body.classList.add(rarityClass);
}

function addToInventory(title, rarityClass) {
    inventory.push({ title, rarityClass });
    // Save to local storage
    localStorage.setItem('inventory', JSON.stringify(inventory));
    renderInventory();
}

function deleteAllFromInventory() {
    inventory = [];
    localStorage.setItem('inventory', JSON.stringify(inventory));
    renderInventory();
    load();
}

function deleteFromInventory(index) {
    inventory.splice(index, 1);
    renderInventory();
    localStorage.setItem('inventory', JSON.stringify(inventory));
    load();
}

function deleteAllByRarity(rarityClass) {
    inventory = inventory.filter(item => item.rarityClass !== rarityClass);
    localStorage.setItem('inventory', JSON.stringify(inventory));
    renderInventory();
}

document.getElementById('toggleInventoryBtn').addEventListener('click', function() {
    const inventorySection = document.querySelector('.inventory');
    const isVisible = inventorySection.style.visibility !== 'visible';

    if (isVisible) {
        inventorySection.style.visibility = 'visible';
        this.textContent = 'Hide Inventory';
    } else {
        inventorySection.style.visibility = 'hidden';
        this.textContent = 'Show Inventory';
    }
});

document.getElementById('toggleCreditsBtn').addEventListener('click', function() {
    const inventorySection = document.querySelector('.info');
    const isVisible = inventorySection.style.visibility !== 'visible';

    if (isVisible) {
        inventorySection.style.visibility = 'visible';
        this.textContent = 'Hide Credits';
    } else {
        inventorySection.style.visibility = 'hidden';
        this.textContent = 'Show Credits';
    }
});

document.getElementById('toggleRollDisplayBtn').addEventListener('click', function() {
    const inventorySection = document.querySelector('.container');
    const isVisible = inventorySection.style.visibility !== 'hidden';

    if (isVisible) {
        inventorySection.style.visibility = 'hidden';
        this.textContent = 'Show Roll & Display';
    } else {
        inventorySection.style.visibility = 'visible';
        this.textContent = 'Hide Roll & Display';
    }
});

// Map of class names to background image URLs and audio IDs
const backgroundDetails = {
    'commonBgImg': { image: 'media/backgrounds/common.png', audio: null },
    'rareBgImg': { image: 'media/backgrounds/rare.png', audio: null },
    'epicBgImg': { image: 'media/backgrounds/epic.png', audio: null },
    'legendaryBgImg': { image: 'media/backgrounds/legendary.png', audio: null },
    'impossibleBgImg': { image: 'media/backgrounds/impossible.png', audio: null },
    'poweredBgImg': { image: 'media/backgrounds/powered.png', audio: null },
    'solarpowerBgImg': { image: 'media/backgrounds/solarpower.png', audio: null },
    'isekaiBgImg': { image: 'media/backgrounds/isekai.png', audio: 'isekaiAudio' },
    'emerBgImg': { image: 'media/backgrounds/emergencies.png', audio: 'emerAudio' },
    'samuraiBgImg': { image: 'media/backgrounds/samurai.png', audio: 'samuraiAudio' },
    'contBgImg': { image: 'media/backgrounds/contortions.png', audio: 'contAudio' },
    'unstoppableBgImg': { image: 'media/backgrounds/unstoppable.gif', audio: 'unstoppableAudio' },
    'gargBgImg': { image: 'media/backgrounds/gargantua.png', audio: 'gargantuaAudio' },
    'oblBgImg': { image: 'media/backgrounds/oblivion.png', audio: 'oblAudio' },
    'frightBgImg': { image: 'media/backgrounds/fright.png', audio: 'frightAudio' },
    'sovereignBgImg': { image: 'media/backgrounds/sovereign.png', audio: 'sovereignAudio' },
    'unnamedBgImg': { image: 'media/backgrounds/unnamed.png', audio: 'unnamedAudio' },
    'engorspaBgImg': { image: 'media/backgrounds/engorspa.png', audio: 'engorspaAudio' },
    'overtureBgImg': { image: 'media/backgrounds/overture.png', audio: 'overtureAudio' },
    'impeachedBgImg': { image: 'media/backgrounds/impeached.png', audio: 'impeachedAudio' },
    'rngmasterBgImg': { image: 'media/backgrounds/rngmaster.png', audio: 'rngmasterAudio' },
    'silcarBgImg': { image: 'media/backgrounds/sillycar.png', audio: 'silcarAudio' },
    'brainrotBgImg': { image: 'media/backgrounds/brainrot.png', audio: 'brainrotAudio' },
    'gregBgImg': { image: 'media/backgrounds/greg.png', audio: 'gregAudio' },
    'mintllieBgImg': { image: 'media/backgrounds/mintllie.png', audio: 'mintllieAudio' },
    'geezerBgGif': { image: 'media/backgrounds/geezer.gif', audio: 'geezerAudio' },
    'polarrBgImg': { image: 'media/backgrounds/polarr.png', audio: 'polarrAudio' },
    'surferBgImg': { image: 'media/backgrounds/surfer.png', audio: 'surferAudio' },
    'oppBgImg': { image: 'media/backgrounds/oppression.jpg', audio: 'oppAudio' }
};

// Store currently playing audio
let currentAudio = null;

let isChangeEnabled = true;  // Global flag to enable/disable background change and music playback

// Function to change the background and play the correct music
function changeBackground(rarityClass, itemTitle) {
    if (!isChangeEnabled) return;  // Check if the functionality is disabled
    const details = backgroundDetails[rarityClass];
    if (details) {
        // Change background image
        document.body.style.backgroundImage = `url(${details.image})`;

        // Stop currently playing audio
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }

        // Play new audio
        if (details.audio) {
            const newAudio = document.getElementById(details.audio);
            if (newAudio) {
                newAudio.play();
                currentAudio = newAudio;
            }
        } else {
            currentAudio = null;
        }
    }
}

// Function to enable the background change and music playback
function enableChange() {
    isChangeEnabled = true;
}

// Function to disable the background change and music playback
function disableChange() {
    isChangeEnabled = false;
}

function renderInventory() {
    const inventoryList = document.getElementById("inventoryList");
    inventoryList.innerHTML = ''; // Clear previous list
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedItems = inventory.slice(start, end);

    paginatedItems.forEach((item, index) => {
        const listItem = document.createElement("li");
        listItem.textContent = item.title;
        listItem.className = item.rarityClass;
        
        // Add equip event listener
        listItem.addEventListener("click", () => {
            equipItem(item);
        });

        const deleteButton = document.createElement("button");
        deleteButton.className = 'fa-solid fa-trash';
        deleteButton.addEventListener("click", (event) => {
            event.stopPropagation(); // Prevent equipItem from being called
            deleteFromInventory(index);
        });

        listItem.appendChild(deleteButton);
        inventoryList.appendChild(listItem);
    });

    updatePagination();
}

function equipItem(item) {
    // Implement the logic for equipping the item
    equippedItem = item;
    console.log(`Equipped item: ${item.title}`);
    // Call the function to handle the UI update
    handleEquippedItem(item);
}

function handleEquippedItem(item) {
    // Change the background to the item's background using the mapping
    changeBackground(item.rarityClass, item.title);
}

function updatePagination() {
    const pageNumber = document.getElementById("pageNumber");
    const backPageButton = document.getElementById("backPageButton");
    const prevPageButton = document.getElementById("prevPageButton");
    const nextPageButton = document.getElementById("nextPageButton");
    const lastPageButton = document.getElementById("lastPageButton");

    const totalPages = Math.ceil(inventory.length / itemsPerPage);
    pageNumber.textContent = `Page ${currentPage} of ${totalPages}`;

    backPageButton.disabled = currentPage === 1;
    prevPageButton.disabled = currentPage === 1;
    nextPageButton.disabled = currentPage === totalPages;
    lastPageButton.disabled = currentPage === totalPages;
}

function backPage() {
    if (currentPage > 1) {
        currentPage = 1;
        renderInventory();
    }
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderInventory();
    }
}

function nextPage() {
    const totalPages = Math.ceil(inventory.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderInventory();
    }
}

function lastPage() {
    const totalPages = Math.ceil(inventory.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage = totalPages;
        renderInventory();
    }
}

function toggleFullscreen() {
    const fullscreenBtn = document.querySelector('.fullscreen-btn');
    const icon = fullscreenBtn.querySelector('i');

    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => {
            fullscreenBtn.innerHTML = '<i class="fa-solid fa-compress"></i>';
        }).catch(err => {
            alert(`Error attempting to enable fullscreen mode: ${err.message} (${err.name})`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen().then(() => {
                fullscreenBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', (event) => {
    document.getElementById('deleteAllButton').addEventListener('click', function() {
        var confirmDelete = confirm("Are you sure you want to delete all Titles?");
        if (confirmDelete) {
            deleteAllFromInventory();
        }
    });
});

function startAnimation() {
    const star = document.getElementById('star');
    
    star.classList.add('spin');
    
    setTimeout(() => {
        star.classList.add('spin-slow');
    }, 3000);
    
    setTimeout(() => {
        star.classList.add('scale-up-and-vanish');
    }, 5000);
    
    setTimeout(() => {
        star.classList.add('cutsceneStar');
        star.classList.remove('scale-up-and-vanish');
        star.classList.remove('spin-slow');
        star.classList.remove('spin');
    }, 7000);
}

function startAnimation1() {
    const star = document.getElementById('star');
    
    star.classList.add('spin');
    
    setTimeout(() => {
        star.classList.add('spin-slow');
    }, 1000);
    
    setTimeout(() => {
        star.classList.add('scale-up-and-vanish');
    }, 2000);
    
    setTimeout(() => {
        star.classList.add('cutsceneStar');
        star.classList.remove('scale-up-and-vanish');
        star.classList.remove('spin-slow');
        star.classList.remove('spin');
    }, 3000);
}

function startAnimation3() {
    const star = document.getElementById('star');
    
    star.classList.add('spin');
    star.classList.remove('hide');
    
    setTimeout(() => {
        star.classList.add('spin-slow');
    }, 3000);
    
    setTimeout(() => {
        star.classList.add('scale-up-and-vanish');
    }, 8000);
    
    setTimeout(() => {
        star.classList.add('hide');
        star.classList.add('cutsceneStar');
        star.classList.remove('scale-up-and-vanish');
        star.classList.remove('spin-slow');
        star.classList.remove('spin');
    }, 12000);
}

function startAnimation4() {
    const star = document.getElementById('star');
    
    star.classList.add('scale-up-and-down');
    
    setTimeout(() => {
        star.classList.add('scale-down');
    }, 7000);
    
    setTimeout(() => {
        star.classList.add('scale-up');
        star.classList.remove('scale-down');
    }, 12000);
    
    setTimeout(() => {
        star.classList.add('scale-down');
        star.classList.remove('scale-up');
    }, 17000);
    
    setTimeout(() => {
        star.classList.add('scale-up');
        star.classList.remove('scale-down');
    }, 22000);
    
    setTimeout(() => {
        star.classList.add('cutsceneStar');
        star.classList.remove('scale-up-and-down');
        star.classList.remove('scale-down');
        star.classList.remove('scale-up');
    }, 27000);
}

function startAnimation5() {
    const star = document.getElementById('star');
    
    star.classList.add('spin');
    
    setTimeout(() => {
        star.classList.add('spin-slow');
    }, 7000);
    
    setTimeout(() => {
        star.classList.add('scale-up-and-vanish');
    }, 15000);
    
    setTimeout(() => {
        star.classList.add('cutsceneStar');
        star.classList.remove('scale-up-and-vanish');
        star.classList.remove('spin-slow');
        star.classList.remove('spin');
    }, 17000);
}

function startAnimation6() {
    const star = document.getElementById('star');
    
    star.classList.add('spin');
    
    setTimeout(() => {
        star.classList.add('spin-slow');
    }, 5000);
    
    setTimeout(() => {
        star.classList.add('scale-up-and-vanish');
    }, 12000);
    
    setTimeout(() => {
        star.classList.add('cutsceneStar');
        star.classList.remove('scale-up-and-vanish');
        star.classList.remove('spin-slow');
        star.classList.remove('spin');
    }, 14000);
}

function startAnimation7() {
    const star = document.getElementById('star');
    
    star.classList.add('spin');
    
    setTimeout(() => {
        star.classList.add('spin-slow');
    }, 1000);
    
    setTimeout(() => {
        star.classList.add('scale-up-and-vanish');
    }, 2000);
    
    setTimeout(() => {
        star.classList.add('cutsceneStar');
        star.classList.remove('scale-up-and-vanish');
        star.classList.remove('spin-slow');
        star.classList.remove('spin');
    }, 4000);
}

function startAnimation8() {
    const oppHeart = document.getElementById('oppHeart');
    
    oppHeart.classList.add('scale-up2');
    
    setTimeout(() => {
        oppHeart.classList.add('show');
        oppHeart.classList.remove('scale-up2');
    }, 1000);
    
    setTimeout(() => {
        oppHeart.classList.add('scale-up2');
        oppHeart.classList.remove('show');
    }, 1200);
    
    setTimeout(() => {
        oppHeart.classList.add('show');
        oppHeart.classList.remove('scale-up2');
    }, 2000);
    
    setTimeout(() => {
        oppHeart.classList.add('scale-up2');
        oppHeart.classList.remove('show');
    }, 2500);
    
    setTimeout(() => {
        oppHeart.classList.add('show');
        oppHeart.classList.remove('scale-up2');
    }, 3200);
    
    setTimeout(() => {
        oppHeart.classList.add('scale-up2');
        oppHeart.classList.remove('show');
    }, 3500);
    
    setTimeout(() => {
        oppHeart.classList.add('show');
        oppHeart.classList.remove('scale-up2');
    }, 3800);
    
    setTimeout(() => {
        oppHeart.classList.add('scale-up2');
        oppHeart.classList.remove('show');
    }, 4000);
    
    setTimeout(() => {
        oppHeart.classList.add('show');
        oppHeart.classList.remove('scale-up2');
    }, 4500);
    
    setTimeout(() => {
        oppHeart.classList.add('scale-up2');
        oppHeart.classList.remove('show');
    }, 4700);
    
    setTimeout(() => {
        oppHeart.classList.add('show');
        oppHeart.classList.remove('scale-up2');
    }, 5200);
    
    setTimeout(() => {
        oppHeart.classList.add('scale-up2');
        oppHeart.classList.remove('show');
    }, 5400);
    
    setTimeout(() => {
        oppHeart.classList.add('show');
        oppHeart.classList.remove('scale-up2');
    }, 5900);
    
    setTimeout(() => {
        oppHeart.classList.add('scale-up22');
        oppHeart.classList.remove('show');
        oppHeart.classList.add('show22');
    }, 6100);
    
    setTimeout(() => {
        oppHeart.classList.add('show2');
        oppHeart.classList.remove('scale-up22');
        oppHeart.classList.remove('show22');
    }, 6300);
    
    setTimeout(() => {
        oppHeart.classList.add('scale-up22');
        oppHeart.classList.remove('show2');
    }, 6400);
    
    setTimeout(() => {
        oppHeart.classList.add('show2');
        oppHeart.classList.add('scale-up222');
        oppHeart.classList.remove('scale-up22');
    }, 6600);
    
    setTimeout(() => {
        oppHeart.classList.add('scale-up22');
        oppHeart.classList.remove('show2');
        oppHeart.classList.remove('scale-up222');
    }, 6700);
    
    setTimeout(() => {
        oppHeart.classList.add('show2');
        oppHeart.classList.remove('scale-up22');
    }, 6900);
    
    setTimeout(() => {
        oppHeart.classList.add('scale-up22');
        oppHeart.classList.remove('show2');
        oppHeart.classList.add('show22');
    }, 7000);
    
    setTimeout(() => {
        oppHeart.classList.add('show2');
        oppHeart.classList.add('scale-up222');
        oppHeart.classList.remove('scale-up22');
        oppHeart.classList.remove('show22');
    }, 7100);
    
    setTimeout(() => {
        oppHeart.classList.add('scale-up22');
        oppHeart.classList.remove('show2');
        oppHeart.classList.remove('scale-up222');
    }, 7200);
    
    setTimeout(() => {
        oppHeart.classList.add('show2');
        oppHeart.classList.add('scale-up222');
        oppHeart.classList.remove('scale-up22');
        oppHeart.classList.remove('show22');
    }, 7300);
    
    setTimeout(() => {
        oppHeart.classList.add('scale-up22');
        oppHeart.classList.remove('show2');
        oppHeart.classList.remove('scale-up222');
    }, 7400);
    
    setTimeout(() => {
        oppHeart.classList.add('cutsceneHeart');
        oppHeart.classList.remove('scale-up22');
        oppHeart.classList.remove('show2');
    }, 7500);
}


document.getElementById("deleteAllCommonButton").addEventListener("click", () => deleteAllByRarity('commonBgImg'));
document.getElementById("deleteAllRareButton").addEventListener("click", () => deleteAllByRarity('rareBgImg'));
document.getElementById("deleteAllEpicButton").addEventListener("click", () => deleteAllByRarity('epicBgImg'));
document.getElementById("deleteAllLegendaryButton").addEventListener("click", () => deleteAllByRarity('legendaryBgImg'));
document.getElementById("deleteAllImpossibleButton").addEventListener("click", () => deleteAllByRarity('impossibleBgImg'));
document.getElementById("deleteAllPoweredButton").addEventListener("click", () => deleteAllByRarity('poweredBgImg'));
document.getElementById("deleteAllSolarpowerButton").addEventListener("click", () => deleteAllByRarity('solarpowerBgImg'));
document.getElementById("deleteAllUnstoppableButton").addEventListener("click", () => deleteAllByRarity('unstoppableBgImg'));
document.getElementById("deleteAllGargantuaButton").addEventListener("click", () => deleteAllByRarity('gargBgImg'));
document.getElementById("deleteAllOblivionButton").addEventListener("click", () => deleteAllByRarity('oblBgImg'));
document.getElementById("deleteAllIsekaiButton").addEventListener("click", () => deleteAllByRarity('isekaiBgImg'));
document.getElementById("deleteAllEmergenciesButton").addEventListener("click", () => deleteAllByRarity('emerBgImg'));
document.getElementById("deleteAllSamuraiButton").addEventListener("click", () => deleteAllByRarity('samuraiBgImg'));
document.getElementById("deleteAllContortionsButton").addEventListener("click", () => deleteAllByRarity('contBgImg'));
document.getElementById("deleteAllFrightButton").addEventListener("click", () => deleteAllByRarity('frightBgImg'));
document.getElementById("deleteAllSovereignButton").addEventListener("click", () => deleteAllByRarity('sovereignBgImg'));
document.getElementById("deleteAllOvertureButton").addEventListener("click", () => deleteAllByRarity('overtureBgImg'));
document.getElementById("deleteAllImpeachedButton").addEventListener("click", () => deleteAllByRarity('impeachedBgImg'));
document.getElementById("deleteAllRNGMasterButton").addEventListener("click", () => deleteAllByRarity('rngmasterBgImg'));
document.getElementById("deleteAll???Button").addEventListener("click", () => deleteAllByRarity('surferBgImg'));

// Set the date we're counting down to
var countDownDate = new Date("Aug 31, 2024 18:00:00").getTime();

// Update the count down every 1 second
var x = setInterval(function() {

  // Get today's date and time
  var now = new Date().getTime();
    
  // Find the distance between now and the count down date
  var distance = countDownDate - now;
    
  // Time calculations for days, hours, minutes and seconds
  var days = Math.floor(distance / (1000 * 60 * 60 * 24));
  var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  var seconds = Math.floor((distance % (1000 * 60)) / 1000);
    
  // Output the result in an element with id="demo"
  document.getElementById("demo").innerHTML = days + " Days " + hours + " Hours "
  + minutes + " Minutes " + seconds + " Seconds ";
    
  // If the count down is over, write some text 
  if (distance < 0) {
    clearInterval(x);
    document.getElementById("demo").innerHTML = "THE EVENT WILL BE OVER IN A FEW. THANK YOU FOR PARTICIPATING AND HOPE YOU GOT OPPRESSION :3";
  }
}, 1000);