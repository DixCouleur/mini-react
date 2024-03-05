const camelCaseToDash = function(camelString) {
    let dash = camelString
    while(true) {
        let matched = dash.match(/[A-Z]/)
        if(matched === null) {
            return dash
        }

        let left = dash.slice(0, matched.index)
        let right = dash.slice(matched.index + 1)
        dash = `${left}-${matched[0].toLowerCase()}${right}`
        console.log('dash', dash)
    }
}

export {
    camelCaseToDash
}