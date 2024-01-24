import * as THREE from '../build/three.module.js'
import {OBJLoader} from '../build/jsm/loaders/OBJLoader.js'
import {scene} from './3d.js'

const material = new THREE.MeshStandardMaterial( {color: 0xffffff, side: THREE.DoubleSide} );
const loader = new OBJLoader();

export class Platform {

	#object;
	#itemObject;

	#seed;
	#originalPositon;

	#loaded = false;

	position;
	size;

	constructor(pos, size, itemPath, seed) {

		this.#originalPositon = pos;
		this.#seed = seed;
		
		this.size = size;

		const geometry = new THREE.PlaneGeometry(this.size.x, this.size.y);
		this.#object = new THREE.Mesh( geometry, material );

		this.#object.castShadow = false;
		this.#object.receiveShadow = true;
		this.#object.rotation.set(Math.PI / 2, 0, 0);

		scene.add( this.#object );

		this.loadItem(itemPath);
		this.updatePosition(new Date().getTime());
	}

	loadItem(itemPath) {
		loader.load(
			itemPath,
			this.addItem.bind(this),
			function ( xhr ) {
				console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
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
		this.#itemObject.scale.set(0.1, 0.1, 0.1);
		scene.add(this.#itemObject);
		this.#loaded = true;
	}

	updatePosition(t) {
		this.position = new THREE.Vector3().copy(this.#originalPositon).add(new THREE.Vector3(0, this.getOffset(t), 0));
		this.#object.position.set(this.position.x, this.position.y, this.position.z);
		if (this.#loaded) {
			this.#itemObject.position.set(this.position.x, this.position.y + 2, this.position.z);
		}
	}

	getOffset(t) {
		return (Math.sin(t + this.#seed) + 1) * 2.5;
	}

}