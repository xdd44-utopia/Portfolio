import * as THREE from '../build/three.module.js'
import {OrbitControls} from '../build/jsm/controls/OrbitControls.js'

import {Platform} from './platform.js'

var isMobile = window.matchMedia("screen and (max-device-width: 450px) and (max-device-height: 950px)");

let SCREEN_WIDTH = window.innerWidth;
let SCREEN_HEIGHT = window.innerHeight;
let aspect = SCREEN_WIDTH / SCREEN_HEIGHT;

let container;
export let scene;
let camera, renderer;
let controls;
let light;

let platform;

init();
animate();

function init() {

	container = document.getElementById("canvas");
	SCREEN_WIDTH = container.clientWidth;
	SCREEN_HEIGHT = container.clientHeight;

	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0x242424 );
	
	//
	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.BasicShadowMap;
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( SCREEN_WIDTH, SCREEN_HEIGHT );
	container.appendChild( renderer.domElement );
	renderer.autoClear = false;

	//
	light = new THREE.DirectionalLight(0xffffff, 1);
	light.castShadow = true;
	light.shadow.camera.left = -50;
	light.shadow.camera.right = 50;
	light.shadow.camera.top = 50;
	light.shadow.camera.bottom = -50;
	light.shadow.mapSize = new THREE.Vector2(2048, 2048);
    light.target.position.set(0, 0, 0);
    scene.add(light);
    scene.add(light.target);

	const ambientLight = new THREE.AmbientLight( 0x404040 ); // soft white light
	scene.add( ambientLight );

	//

	camera = new THREE.PerspectiveCamera( 50, aspect, 1, 10000 );
	camera.position.x = 10 * 0.68;
	camera.position.y = 10 * 0.27;
	camera.position.z = 10 * 0.68;

	//

	controls = new OrbitControls(camera, container);
	controls.maxDistance = isMobile ? 20 : 10;
	controls.minDistance = isMobile ? 6 : 3;
	controls.maxPolarAngle = Math.PI / 2;
	controls.minPolarAngle = Math.PI / 4;
	controls.panSpeed = 0.8;
	controls.rotateSpeed = 0.8;
	controls.zoomSpeed = 0.8;

	// Geometries
	let path = './models/main.obj';
	platform = new Platform(new THREE.Vector3(0, -2, 0), 1, path);
	

	//
	window.addEventListener( 'resize', onWindowResize );
	document.addEventListener( 'keydown', onKeyDown );

}

function initCamera() {

}

function onWindowResize() {

	SCREEN_WIDTH = container.clientWidth;
	SCREEN_HEIGHT = container.clientHeight;
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
	let t = new Date().getTime() / 5000;
    light.position.set(40 * Math.cos(t * 4), 40, 20 * Math.sin(t * 4));
	platform.updateRotation(t);
}