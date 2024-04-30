import * as THREE from '../build/three.module.js'
import {OBJLoader} from '../build/jsm/loaders/OBJLoader.js'
import {scene} from './3d.js'

const material = new THREE.MeshStandardMaterial( {color: 0xffffff, side: THREE.DoubleSide} );
const loader = new OBJLoader();

export class Platform {

	#object;
	#itemObject;

	position;
	size;

	constructor(pos, size, itemPath, itemName) {

		this.position = pos;
		this.size = size;

		const geometry = new THREE.CylinderGeometry(1 * size, 1.6 * size, 0.4 * size, 32);
		this.#object = new THREE.Mesh( geometry, material );

		this.#object.position.set(pos.x, pos.y, pos.z);
		this.#object.castShadow = false;
		this.#object.receiveShadow = true;

		scene.add( this.#object );

		var loadProgress = document.getElementById("loadProgress");

		loader.load(
			itemPath,
			this.addItem.bind(this),
			function ( xhr ) {
				loadProgress.innerHTML = "Loading model: " + Math.round( xhr.loaded / xhr.total * 10000 ) / 100 + "%";
			},
			function ( error ) {
				console.log( error );
			}
		);
	}

	addItem(object) {

		this.#itemObject = object;
		this.#itemObject.material = material;
		this.#itemObject.traverse(function(child){child.castShadow = true;});
		this.#itemObject.position.set(this.position.x, this.position.y + 0.4, this.position.z);
		this.#itemObject.scale.set(this.size, this.size, this.size);
		scene.add(this.#itemObject);
		loadProgress.innerHTML = "Drag to rotate the model";
	}

	updateRotation(t) {
		if (this.#itemObject == null) {
			return;
		}
		this.#itemObject.rotation.set(0, t, 0);
	}

}