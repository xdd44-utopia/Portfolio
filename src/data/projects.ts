export interface ProjectCardData {
    title: string;
    href: string;
    target: string;
    image?: string;
    alt?: string;
    sources?: { src: string; type: string }[];
}

export interface HomeCategory {
    id: string;
    title: string;
    projects: ProjectCardData[];
}

export const categories: HomeCategory[] = [
    {
        "id": "AAD",
        "title": "Design · Art · Architecture",
        "projects": [
            {
                "title": "Feral AI Companion",
                "href": "/Art/Feral",
                "target": "_blank",
                "image": "/image/Art/Feral/feral.gif",
                "alt": "Feral AI"
            },
            {
                "title": "Hi-Fi Spacesuit",
                "href": "/Architecture/Hi-Fi",
                "target": "_blank",
                "image": "/image/Architecture/Hi-Fi/Cover.jpg",
                "alt": "Spacesuit"
            },
            {
                "title": "Gaze to the Stars",
                "href": "/Art/Gaze",
                "target": "_blank",
                "image": "/image/Art/Gaze/cover.jpg",
                "alt": "Gaze to the Stars"
            },
            {
                "title": "Memory Still",
                "href": "/Art/Memory",
                "target": "_blank",
                "image": "/image/Art/MemoryStill/1.jpg",
                "alt": "Memory Still"
            },
            {
                "title": "How to Make (Almost) Anything",
                "href": "https://fab.cba.mit.edu/classes/863.24/people/ChenyueXddDai/",
                "target": "_blank",
                "sources": [
                    {
                        "src": "/files/HTMAA.mp4",
                        "type": "video/mp4"
                    },
                    {
                        "src": "/files/HTMAA.ogg",
                        "type": "video/ogg"
                    }
                ]
            },
            {
                "title": "Momo: a Lunar Habitat",
                "href": "/Architecture/SpaceArch",
                "target": "_blank",
                "image": "/image/Architecture/SpaceArch/Cover.jpg",
                "alt": "Momo: a Lunar Habitat"
            },
            {
                "title": "Unfamiliar Familiarity",
                "href": "/Art/Unfamiliar",
                "target": "_blank",
                "image": "/image/Art/Unfamiliar/Cover.jpg",
                "alt": "Unfamiliar Familiarity"
            },
            {
                "title": "Computed Transparency",
                "href": "/Art/ComputedTransparency",
                "target": "_blank",
                "image": "/image/Art/ComputedTransparency/Cover.jpg",
                "alt": "Computed Transparency"
            },
            {
                "title": "Minimum Spanning Erosion",
                "href": "/Art/MSErosion",
                "target": "_blank",
                "image": "/image/Art/MSErosion/Cover.jpg",
                "alt": "Minimum Spanning Erosion"
            },
            {
                "title": "Life",
                "href": "/Art/Life",
                "target": "_blank",
                "image": "/image/Art/Life/Whole.JPG",
                "alt": "Life"
            },
            {
                "title": "A Study in Windows",
                "href": "/Architecture/Cornell",
                "target": "_blank",
                "image": "/image/Architecture/Cornell/Final.jpg",
                "alt": "A Study in Windows"
            },
            {
                "title": "Logo",
                "href": "/Art/Logo",
                "target": "_blank",
                "image": "/image/Art/Logo/logo-image.jpg",
                "alt": "Logo"
            }
        ]
    },
    {
        "id": "Programming",
        "title": "Interface · Interaction · Computing",
        "projects": [
            {
                "title": "AngleCAD",
                "href": "/Computing/AngleCAD",
                "target": "_blank",
                "image": "/image/Programming/HCI/Cover.png",
                "alt": "AngleCAD"
            },
            {
                "title": "Arkala: LLM-Driven Game",
                "href": "/Computing/Arkala",
                "target": "_blank",
                "image": "/image/Programming/Arkala/cover.jpg",
                "alt": "Arkala"
            },
            {
                "title": "Furniture Removal Pipeline",
                "href": "https://docs.google.com/presentation/d/1JAXFD15cRr0VYQufnKurnH0ndNGuX6j2xw4Sy-Splvg/edit?usp=sharing",
                "target": "_blank",
                "image": "/image/Programming/Removal/Cover.png",
                "alt": "Furniture Removal Pipeline"
            }
        ]
    },
    {
        "id": "Photography",
        "title": "Photography",
        "projects": [
            {
                "title": "Automonument",
                "href": "/Photography/Automonument",
                "target": "_blank",
                "image": "/image/Photography/Automonument/3_1.jpg",
                "alt": "Automonument"
            },
            {
                "title": "Decisive Moment",
                "href": "/Photography/Decisive",
                "target": "_blank",
                "image": "/image/Photography/Decisive/0.jpg",
                "alt": "Decisive Moment"
            },
            {
                "title": "Inhabiting",
                "href": "/Photography/Inhabiting",
                "target": "_blank",
                "image": "/image/Photography/Inhabiting/0.jpg",
                "alt": "Inhabiting"
            },
            {
                "title": "Iceland",
                "href": "/Photography/Iceland",
                "target": "_blank",
                "image": "/image/Photography/Iceland/Inhabitants1.jpg",
                "alt": "Iceland"
            },
            {
                "title": "Scotland",
                "href": "/Photography/Scotland",
                "target": "_blank",
                "image": "/image/Photography/Scotland/Nature1.jpg",
                "alt": "Scotland"
            },
            {
                "title": "Norway",
                "href": "/Photography/Norway",
                "target": "_blank",
                "image": "/image/Photography/Norway/Cover.jpg",
                "alt": "Norway"
            }
        ]
    }
];
