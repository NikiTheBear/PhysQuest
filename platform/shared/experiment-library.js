// Converted from PhysQuest, MIT; see physquest/LICENSE.
export const EXPERIMENT_FILES = [
  {
    "format": "physquest.experiment",
    "version": 1,
    "metadata": {
      "title": "让像和蜡烛一样大",
      "description": "把蜡烛挪一挪，让光屏上的像恰好和蜡烛一样大。",
      "source": {
        "project": "PhysQuest",
        "commit": "d1e6abd934ec0d43b90bfccad145f2778056f8b1",
        "license": "MIT",
        "challengeId": "CH-O2-01"
      }
    },
    "experiment": {
      "id": "CH-O2-01",
      "title": "让像和蜡烛一样大",
      "goal": "把蜡烛挪一挪，让光屏上的像恰好和蜡烛一样大。",
      "mode": "2d",
      "environment": {
        "gravity": 9.81,
        "damping": 0.02,
        "speed": 1,
        "collisions": true
      },
      "components": [
        {
          "id": "lens-bench",
          "kind": "lens_bench",
          "name": "凸透镜光具座",
          "position": [
            0,
            1,
            0
          ],
          "params": {
            "u": 30,
            "f": 10,
            "h": 2.5,
            "screenX": 15,
            "lensDiameter": 6,
            "maskTop": 0,
            "objectShape": 0
          },
          "refs": {},
          "fixed": true
        }
      ],
      "connections": [],
      "control": {
        "running": false,
        "reset": 0
      },
      "learning": {
        "id": "CH-O2-01",
        "labId": "optics-lens",
        "title": "让像和蜡烛一样大",
        "brief": "把蜡烛挪一挪，让光屏上的像恰好和蜡烛一样大。",
        "hint": "一倍焦距不够，三倍焦距太多。中间有个特殊的位置。",
        "winCondition": {
          "metric": "m",
          "op": "≈",
          "value": -1,
          "tolerance": 0.06
        },
        "multiAnswer": false,
        "knowledgeIds": [
          "K-O2-06"
        ],
        "misconceptionIds": [
          "MIS-O2-05"
        ],
        "demoScriptId": "demo-equal-2f",
        "difficulty": "beginner",
        "prediction": {
          "prompt": "先把蜡烛放在两倍焦距以外，再把光屏挪到像能清楚出现的地方。你猜屏上的像会是什么样？",
          "options": [
            "倒立、比蜡烛小",
            "倒立、和蜡烛一样大",
            "正立、比蜡烛大"
          ],
          "answerIndex": 0
        }
      },
      "source": {
        "project": "PhysQuest",
        "commit": "d1e6abd934ec0d43b90bfccad145f2778056f8b1",
        "license": "MIT",
        "challengeId": "CH-O2-01"
      }
    }
  },
  {
    "format": "physquest.experiment",
    "version": 1,
    "metadata": {
      "title": "让像比蜡烛大三倍",
      "description": "调到放大率大约 3 倍，看看这时候光屏要放到多远。",
      "source": {
        "project": "PhysQuest",
        "commit": "d1e6abd934ec0d43b90bfccad145f2778056f8b1",
        "license": "MIT",
        "challengeId": "CH-O2-02"
      }
    },
    "experiment": {
      "id": "CH-O2-02",
      "title": "让像比蜡烛大三倍",
      "goal": "调到放大率大约 3 倍，看看这时候光屏要放到多远。",
      "mode": "2d",
      "environment": {
        "gravity": 9.81,
        "damping": 0.02,
        "speed": 1,
        "collisions": true
      },
      "components": [
        {
          "id": "lens-bench",
          "kind": "lens_bench",
          "name": "凸透镜光具座",
          "position": [
            0,
            1,
            0
          ],
          "params": {
            "u": 20,
            "f": 10,
            "h": 2.5,
            "screenX": 20,
            "lensDiameter": 6,
            "maskTop": 0,
            "objectShape": 0
          },
          "refs": {},
          "fixed": true
        }
      ],
      "connections": [],
      "control": {
        "running": false,
        "reset": 0
      },
      "learning": {
        "id": "CH-O2-02",
        "labId": "optics-lens",
        "title": "让像比蜡烛大三倍",
        "brief": "调到放大率大约 3 倍，看看这时候光屏要放到多远。",
        "hint": "想放大，物体就得离透镜更近一点——但别越过焦距。",
        "winCondition": {
          "metric": "m",
          "op": "≈",
          "value": -3,
          "tolerance": 0.4
        },
        "multiAnswer": false,
        "knowledgeIds": [
          "K-O2-07",
          "K-O2-11"
        ],
        "misconceptionIds": [
          "MIS-O2-05",
          "MIS-O2-06",
          "MIS-O2-08",
          "MIS-O2-09"
        ],
        "demoScriptId": "demo-magnify",
        "difficulty": "beginner",
        "prediction": {
          "prompt": "要让像变大，你觉得物体该往哪个方向挪？",
          "options": [
            "离透镜更远",
            "离透镜更近（但仍在焦距以外）",
            "往哪个方向都一样"
          ],
          "answerIndex": 1
        }
      },
      "source": {
        "project": "PhysQuest",
        "commit": "d1e6abd934ec0d43b90bfccad145f2778056f8b1",
        "license": "MIT",
        "challengeId": "CH-O2-02"
      }
    }
  },
  {
    "format": "physquest.experiment",
    "version": 1,
    "metadata": {
      "title": "让光屏上什么都没有",
      "description": "想办法让光屏上接不到像。至少有三种做法，你能找到几种？",
      "source": {
        "project": "PhysQuest",
        "commit": "d1e6abd934ec0d43b90bfccad145f2778056f8b1",
        "license": "MIT",
        "challengeId": "CH-O2-03"
      }
    },
    "experiment": {
      "id": "CH-O2-03",
      "title": "让光屏上什么都没有",
      "goal": "想办法让光屏上接不到像。至少有三种做法，你能找到几种？",
      "mode": "2d",
      "environment": {
        "gravity": 9.81,
        "damping": 0.02,
        "speed": 1,
        "collisions": true
      },
      "components": [
        {
          "id": "lens-bench",
          "kind": "lens_bench",
          "name": "凸透镜光具座",
          "position": [
            0,
            1,
            0
          ],
          "params": {
            "u": 30,
            "f": 10,
            "h": 2.5,
            "screenX": 15,
            "lensDiameter": 6,
            "maskTop": 0,
            "objectShape": 0
          },
          "refs": {},
          "fixed": true
        }
      ],
      "connections": [],
      "control": {
        "running": false,
        "reset": 0
      },
      "learning": {
        "id": "CH-O2-03",
        "labId": "optics-lens",
        "title": "让光屏上什么都没有",
        "brief": "想办法让光屏上接不到像。至少有三种做法，你能找到几种？",
        "hint": "除了挪光屏，也可以试试挪蜡烛。",
        "winCondition": {
          "metric": "screenHasImage",
          "op": "false"
        },
        "multiAnswer": true,
        "knowledgeIds": [
          "K-O2-08",
          "K-O2-09",
          "K-O2-13"
        ],
        "misconceptionIds": [
          "MIS-O2-02",
          "MIS-O2-07",
          "MIS-O2-01"
        ],
        "demoScriptId": "demo-no-image",
        "difficulty": "beginner",
        "prediction": {
          "prompt": "如果蜡烛正好放在焦点上（u = f），光屏上会看到什么？",
          "options": [
            "一个特别大的像",
            "什么都没有",
            "一个特别小的像"
          ],
          "answerIndex": 1
        }
      },
      "source": {
        "project": "PhysQuest",
        "commit": "d1e6abd934ec0d43b90bfccad145f2778056f8b1",
        "license": "MIT",
        "challengeId": "CH-O2-03"
      }
    }
  },
  {
    "format": "physquest.experiment",
    "version": 1,
    "metadata": {
      "title": "遮住透镜上半部分",
      "description": "先用纸片遮住透镜的上半部分，再猜光屏上的像会变成什么样。",
      "source": {
        "project": "PhysQuest",
        "commit": "d1e6abd934ec0d43b90bfccad145f2778056f8b1",
        "license": "MIT",
        "challengeId": "CH-O2-04"
      }
    },
    "experiment": {
      "id": "CH-O2-04",
      "title": "遮住透镜上半部分",
      "goal": "先用纸片遮住透镜的上半部分，再猜光屏上的像会变成什么样。",
      "mode": "2d",
      "environment": {
        "gravity": 9.81,
        "damping": 0.02,
        "speed": 1,
        "collisions": true
      },
      "components": [
        {
          "id": "lens-bench",
          "kind": "lens_bench",
          "name": "凸透镜光具座",
          "position": [
            0,
            1,
            0
          ],
          "params": {
            "u": 30,
            "f": 10,
            "h": 2.5,
            "screenX": 15,
            "lensDiameter": 6,
            "maskTop": 0,
            "objectShape": 0
          },
          "refs": {},
          "fixed": true
        }
      ],
      "connections": [],
      "control": {
        "running": false,
        "reset": 0
      },
      "learning": {
        "id": "CH-O2-04",
        "labId": "optics-lens",
        "title": "遮住透镜上半部分",
        "brief": "先用纸片遮住透镜的上半部分，再猜光屏上的像会变成什么样。",
        "hint": "想想：像的位置是谁决定的？",
        "winCondition": {
          "metric": "relativeIlluminance",
          "op": "<",
          "value": 0.75
        },
        "multiAnswer": false,
        "knowledgeIds": [
          "K-O2-04",
          "K-O2-13"
        ],
        "misconceptionIds": [
          "MIS-O2-04"
        ],
        "demoScriptId": "demo-mask-half",
        "difficulty": "advanced",
        "prediction": {
          "prompt": "把透镜的上半部分用纸片遮住，光屏上的像会怎样？",
          "options": [
            "只剩下一半的像",
            "像完整，只是变暗",
            "像会挪到上面去"
          ],
          "answerIndex": 1
        }
      },
      "source": {
        "project": "PhysQuest",
        "commit": "d1e6abd934ec0d43b90bfccad145f2778056f8b1",
        "license": "MIT",
        "challengeId": "CH-O2-04"
      }
    }
  },
  {
    "format": "physquest.experiment",
    "version": 1,
    "metadata": {
      "title": "看到那个接不住的像",
      "description": "不用光屏，想办法看到一正立、放大的像。",
      "source": {
        "project": "PhysQuest",
        "commit": "d1e6abd934ec0d43b90bfccad145f2778056f8b1",
        "license": "MIT",
        "challengeId": "CH-O2-05"
      }
    },
    "experiment": {
      "id": "CH-O2-05",
      "title": "看到那个接不住的像",
      "goal": "不用光屏，想办法看到一正立、放大的像。",
      "mode": "2d",
      "environment": {
        "gravity": 9.81,
        "damping": 0.02,
        "speed": 1,
        "collisions": true
      },
      "components": [
        {
          "id": "lens-bench",
          "kind": "lens_bench",
          "name": "凸透镜光具座",
          "position": [
            0,
            1,
            0
          ],
          "params": {
            "u": 30,
            "f": 10,
            "h": 2.5,
            "screenX": 15,
            "lensDiameter": 6,
            "maskTop": 0,
            "objectShape": 0
          },
          "refs": {},
          "fixed": true
        }
      ],
      "connections": [],
      "control": {
        "running": false,
        "reset": 0
      },
      "learning": {
        "id": "CH-O2-05",
        "labId": "optics-lens",
        "title": "看到那个接不住的像",
        "brief": "不用光屏，想办法看到一正立、放大的像。",
        "hint": "放大镜怎么用，这里就怎么用。",
        "winCondition": {
          "metric": "real",
          "op": "false"
        },
        "multiAnswer": true,
        "knowledgeIds": [
          "K-O2-09",
          "K-O2-10",
          "K-O2-15"
        ],
        "misconceptionIds": [
          "MIS-O2-03",
          "MIS-O2-10"
        ],
        "demoScriptId": "demo-virtual-image",
        "difficulty": "beginner",
        "prediction": {
          "prompt": "把蜡烛挪到焦距以内，光屏上还能接到像吗？",
          "options": [
            "能，只是更模糊",
            "不能，但如果从透镜里看出去能看到像",
            "不能，而且根本没有任何像"
          ],
          "answerIndex": 1
        }
      },
      "source": {
        "project": "PhysQuest",
        "commit": "d1e6abd934ec0d43b90bfccad145f2778056f8b1",
        "license": "MIT",
        "challengeId": "CH-O2-05"
      }
    }
  }
];
