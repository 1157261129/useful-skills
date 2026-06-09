# Support Java and TypeScript Vue projects first

The first version of the tool catalog supports Java Spring Boot Maven projects, general TypeScript and JavaScript utility modules, and Vue projects. The concept model remains language-neutral so later detectors can add React, Python, and other ecosystems without redefining utility artifacts, but React-specific and Python-specific detectors are not part of the first version.

**Consequences**

- Discovery uses language-specific detectors instead of one generic parser.
- Index records need language and framework metadata so consulting can filter results by the current coding context.
- Backend and frontend records share one target project index instead of separate databases.
- Vue discovery targets Vue 3 common structures, utility modules, composables, and recurring template patterns; Vue 2 mixins and page-level component analysis are outside the first version.
