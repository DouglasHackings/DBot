import NumberConversionError from '../../errors/NumberConversionError.js';
import IntegerRangeError from '../../errors/IntegerRangeError.js';


export default {
    name: 'sigfig',
    description: 'gets the sigfig info of a given number.',
    pattern: '[Number]',
    examples: ['sigfig 5.0', 'sigfig 32.582736'],
    execute(message, parsed) {
        let { number } = parsed;

        if (isNaN(number))
            throw new NumberConversionError(this.name, 'Number');
        if (Number(number) > Number.MAX_SAFE_INTEGER)
            throw new IntegerRangeError(this.name, 'Number', undefined, 'the JS maximum safe integer');

        // Since e is never significant, ignore it for the calculations and add it in at the end
        let [num, expt] = number.split('e');
        let exponent = expt !== undefined
            ? `e${expt}`
            : '';

        let [whole, dec] = num.split('.');
        if (dec !== undefined) {
            // If a decimal point exists and the number is not 0, everything past the decimal point is significant
            if (Number(whole)) {
                let decimal = dec === '' ? '' : `**${dec}**`; // Sad but necessary to make sure no formatting errors occur with numbers like 400.

                let {text, significant} = parseTrailingZeroes(whole, true, false);
                return message.channel.send(`${text}.${decimal}${exponent}, ${significant + dec.length} significant figure(s)`);
            }

            // Otherwise, preceding zeros are insignificant
            let {text, significant} = parseTrailingZeroes(dec, true, false);
            return message.channel.send(`${whole}.${text}${exponent}, ${significant} significant figure(s)`);
        }

        // For integers, both preceding and succeeding zeros are insignificant
        let {text, significant} = parseTrailingZeroes(num, true, true);
        message.channel.send(`${text}${exponent}, ${significant} significant figure(s)`);
    }
}

const parseTrailingZeroes = (num, preceding, succeeding) => {
    let temp = Number(num);
    let left = 0, right = num.length; // Indexes for slicing

    // Base case for 0 to prevent infinite loop
    if (temp === 0) return {
        text: num,
        significant: 0
    };

    // If preceding zeros are insignificant
    if (preceding) {
        let zeros = num.match(/^0+/);
        if (zeros) left = zeros[0].length;
    }

    // If succeeding zeros are insignificant
    if (succeeding) {
        // Loop until all trailing zeros have been sliced
        while (temp % 10 === 0) {
            temp /= 10;
            right--;
        }
    }

    let before = num.slice(0, left);
    let significant = num.slice(left, right);
    let after = num.slice(right);

    return {
        text: `${before}**${significant}**${after}`,
        significant: significant.length
    };
}
