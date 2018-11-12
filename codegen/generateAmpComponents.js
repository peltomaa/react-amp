const { Project, VariableDeclarationKind } = require('ts-simple-ast');
const amphtmlValidatorRules = require('amphtml-validator-rules');

const name = require('./tagNameToComponentName');
const BLACKLIST = require('./BLACKLIST.json');

const project = new Project();
const rules = amphtmlValidatorRules.amp.validator.createRules();
// console.log(rules);

// Remove tags that are Blacklisted and duplicates
const filteredTags = rules.tags.filter((value, index, array) => { 
    return BLACKLIST.indexOf(value.tagName) < 0 && array.findIndex((item) => item.tagName == value.tagName) == index;
});

const file = project.createSourceFile('./src/gen/AMP.ts', {
    imports: [{
        moduleSpecifier: 'react',
        namespaceImport: 'React'
    }]
}, {
    overwrite: true
});

filteredTags.forEach(tag => {
    // Tag name
    const componentName = name(tag.tagName);

    // Generate props
    const allAttr = [...tag.attrs, ...rules.globalAttrs, ...rules.ampLayoutAttrs, ...tag.attrLists.reduce((allAttrFromLists, list) => [
        ...allAttrFromLists,
        ...rules.directAttrLists[list],
    ], [])];
    const props = allAttr.map(
        attr => (attr > 0 ? rules.attrs[attr] : rules.internedStrings[-1 * attr])
    ).reduce((props, prop) => {
        const propIsString = typeof prop === 'string';

        if (propIsString) {
            props.push({
                name: prop,
                required: false
            });
        } else if (prop) {
            props.push({
                name: prop.name,
                required: prop.mandatory
            });
        }

        return props;
    }, []).filter((value, index, array) => {
        return array.findIndex((item) => item.name == value.name) == index;
    });

    // Create Interface
    const interfaceDeclaration = file.addInterface({
        name: componentName + 'Props'
    });

    interfaceDeclaration.addProperties(props.map(({ name, required }) => ({
        name: `'${name}'`,
        type: 'any',
        hasQuestionToken: !required
    })));
    
    interfaceDeclaration.addIndexSignature({
        keyName: 'prop',
        keyType: 'string',
        returnType: 'any'
    });
    
    // Create React Component
    file.addVariableStatement({
        declarationKind: VariableDeclarationKind.Const,
        declarations: [{
            name: componentName,
            type: `React.FunctionComponent<${interfaceDeclaration.getName()}>`,
            initializer: `(props) => React.createElement('${tag.tagName.toLowerCase()}', props, props.children)`,
            isExported: true
        }]
    });

    file.addExportDeclaration({
        namedExports: [componentName]
    });
});

project.save();
