import * as THREE from '../build/three.module.js'
import {OBJLoader} from '../build/jsm/loaders/OBJLoader.js'
import {OrbitControls} from '../build/jsm/controls/OrbitControls.js'

import {Platform} from './platform_archive.js'
import {Connection} from './connection_archive.js'

var isMobile = window.matchMedia("screen and (max-device-width: 450px) and (max-device-height: 950px)");

let SCREEN_WIDTH = window.innerWidth;
let SCREEN_HEIGHT = window.innerHeight;
let aspect = SCREEN_WIDTH / SCREEN_HEIGHT;

let container;
export let scene;
let camera, renderer;

let platforms = [];
let connections = [];

init();
animate();

function init() {

	container = document.createElement( 'div' );
	document.body.appendChild( container );

	scene = new THREE.Scene();
	
	//
	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.BasicShadowMap;
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( SCREEN_WIDTH, SCREEN_HEIGHT );
	container.appendChild( renderer.domElement );
	renderer.autoClear = false;

	//
	const light = new THREE.DirectionalLight(0xffffff, 1);
	light.castShadow = true;
	light.shadow.camera.left = -50;
	light.shadow.camera.right = 50;
	light.shadow.camera.top = 50;
	light.shadow.camera.bottom = -50;
	light.shadow.mapSize = new THREE.Vector2(2048, 2048);
    light.position.set(40, 40, 20);
    light.target.position.set(0, 0, 0);
    scene.add(light);
    scene.add(light.target);

	const ambientLight = new THREE.AmbientLight( 0x404040 ); // soft white light
	scene.add( ambientLight );

	//

	camera = new THREE.PerspectiveCamera( 50, aspect, 1, 10000 );
	camera.position.x = 50 * 0.68;
	camera.position.y = 50 * 0.27;
	camera.position.z = 50 * 0.68;
	camera.lookAt(new THREE.Vector3(0, 5, 0));

	//

	const controls = new OrbitControls(camera, container);
	controls.maxDistance = isMobile ? 60 : 30;
	controls.minDistance = isMobile ? 20 : 10;
	controls.maxPolarAngle = Math.PI / 2;
	controls.minPolarAngle = Math.PI / 4;
	controls.panSpeed = 0.8;
	controls.rotateSpeed = 0.8;
	controls.zoomSpeed = 0.8;

	//
	const material = new THREE.MeshStandardMaterial({
		color:0xffffff,
		wireframe: true,
	});

	//
	for (let i = 0; i <= 2; i++) {
		platforms.push([]);
		for (let j = 0; j <= 2; j++) {
			let pos = new THREE.Vector3((i - 1) * 15, Math.random() * 2.5, (j - 1) * 15)
			let size = new THREE.Vector2(Math.random() + 0.5, Math.random() + 0.5).multiplyScalar(8);
			platforms[i].push(new Platform(pos, size, './models/test.obj', Math.random() * Math.PI));
		}
	}
	for (let i = 0; i <= 2; i++) {
		for (let j = 0; j <= 2; j++) {
			if (i < 2) {
				connections.push(new Connection(platforms[i][j], platforms[i+1][j], true));
			}
			if (j < 2) {
				connections.push(new Connection(platforms[i][j], platforms[i][j+1], false));
			}
		}
	}

	//
	window.addEventListener( 'resize', onWindowResize );
	document.addEventListener( 'keydown', onKeyDown );

}

function onWindowResize() {

	SCREEN_WIDTH = window.innerWidth;
	SCREEN_HEIGHT = window.innerHeight;
	aspect = SCREEN_WIDTH / SCREEN_HEIGHT;

	renderer.setSize( SCREEN_WIDTH, SCREEN_HEIGHT );

	camera.aspect = aspect;
	camera.updateProjectionMatrix();

}

function onKeyDown( event ) {

	// switch ( event.keyCode ) {

	// 	case 79: /*O*/

	// 		activeCamera = cameraOrtho;

	// 		break;

	// 	case 80: /*P*/

	// 		activeCamera = cameraPerspective;

	// 		break;

	// }

}

function animate() {
	requestAnimationFrame( animate );
	render();
}


function render() {
	update();

	renderer.clear();

	renderer.setViewport(0, 0,SCREEN_WIDTH ,SCREEN_HEIGHT);
	renderer.render(scene, camera);
	
}

function update() {
	for (let i = 0; i <= 2; i++) {
		for (let j = 0; j <= 2; j++) {
			platforms[i][j].updatePosition(new Date().getTime() / 5000);
		}
	}
	for (let i = 0; i < connections.length; i++) {
		connections[i].connect();
	}
}