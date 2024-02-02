import * as THREE from '../build/three.module.js'
import {CustomFirstPersonControls} from './CustomFirstPersonControls.js'

import {Platform} from './platform.js'

var isMobile = window.matchMedia("screen and (max-device-width: 450px) and (max-device-height: 950px)");

let SCREEN_WIDTH = window.innerWidth;
let SCREEN_HEIGHT = window.innerHeight;
let aspect = SCREEN_WIDTH / SCREEN_HEIGHT;

let container;
export let scene;
let camera, renderer;
let controls;
let light

let platforms = [];
let connections = [];

let practiceNum = 5;
let finalNum = 3;

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
	camera.position.x = 0;
	camera.position.y = 1.12;
	camera.position.z = 0;
	camera.lookAt(new THREE.Vector3(1, 1.12, 1));

	//

	controls = new CustomFirstPersonControls(camera, container);

	//
	const groundMaterial = new THREE.MeshStandardMaterial( {color: 0x888888, side: THREE.DoubleSide} );

	// Ground

	const planeGeometry = new THREE.PlaneGeometry(50, 50);
	let ground = new THREE.Mesh( planeGeometry, groundMaterial );
	ground.castShadow = false;
	ground.receiveShadow = true;
	ground.rotation.set(Math.PI / 2, 0, 0);
	scene.add(ground);

	// Practice Geometries
	for (let i = 1; i <= practiceNum; i++) {
		let pos = new THREE.Vector3(12 * Math.cos((i - 1) * Math.PI * 2 / practiceNum), 0, 12 * Math.sin((i - 1) * Math.PI * 2 / practiceNum));
		let path = './models/P' + i + '.obj';
		let p = new Platform(pos, 0.5, path);
		platforms.push(p);
	}

	// Final Geometries
	for (let i = 1; i <= finalNum; i++) {
		let pos = new THREE.Vector3(4 * Math.cos((i - 0.5) * Math.PI * 2 / finalNum), 0, 4 * Math.sin((i - 0.5) * Math.PI * 2 / finalNum));
		let path = './models/' + i + '.obj';
		let p = new Platform(pos, 1, path);
		platforms.push(p);
	}
	

	//
	window.addEventListener( 'resize', onWindowResize );
	document.addEventListener( 'keydown', onKeyDown );

}

function initCamera() {

}

function onWindowResize() {

	SCREEN_WIDTH = window.innerWidth;
	SCREEN_HEIGHT = window.innerHeight;
	aspect = SCREEN_WIDTH / SCREEN_HEIGHT;

	renderer.setSize( SCREEN_WIDTH, SCREEN_HEIGHT );

	camera.aspect = aspect;
	camera.updateProjectionMatrix();

	controls.handleResize();

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
	controls.update(0.2);
	camera.position.y = 1.12;
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
	for (let i = 0; i < practiceNum + finalNum; i++) {
		platforms[i].updateRotation(t);
	}
}