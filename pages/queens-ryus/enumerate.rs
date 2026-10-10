use std::collections::BTreeMap;
use std::env;
use std::process;

fn search(n: usize, used: &mut [bool], cols: &mut Vec<usize>, out: &mut Vec<Vec<usize>>) {
    if cols.len() == n {
        out.push(cols.clone());
        return;
    }

    for col in 1..=n {
        if used[col] {
            continue;
        }
        if let Some(&prev) = cols.last() {
            if prev.abs_diff(col) == 1 {
                continue;
            }
        }

        used[col] = true;
        cols.push(col);
        search(n, used, cols, out);
        cols.pop();
        used[col] = false;
    }
}

fn placements(n: usize) -> Vec<Vec<usize>> {
    let mut used = vec![false; n + 1];
    let mut cols = Vec::with_capacity(n);
    let mut out = Vec::new();
    search(n, &mut used, &mut cols, &mut out);
    out
}

fn label(cols: &[usize]) -> String {
    if cols.len() <= 9 {
        cols.iter().map(|col| col.to_string()).collect()
    } else {
        cols.iter()
            .map(|col| col.to_string())
            .collect::<Vec<_>>()
            .join(" ")
    }
}

fn transform(cols: &[usize], kind: usize) -> Vec<usize> {
    let n = cols.len();
    let mut transformed = vec![0; n];

    for (row0, &col) in cols.iter().enumerate() {
        let row = row0 + 1;
        let (new_row, new_col) = match kind {
            0 => (row, col),
            1 => (col, n + 1 - row),
            2 => (n + 1 - row, n + 1 - col),
            3 => (n + 1 - col, row),
            4 => (row, n + 1 - col),
            5 => (n + 1 - col, n + 1 - row),
            6 => (n + 1 - row, col),
            7 => (col, row),
            _ => unreachable!(),
        };
        transformed[new_row - 1] = new_col;
    }

    transformed
}

fn canonical(cols: &[usize]) -> Vec<usize> {
    (0..8).map(|kind| transform(cols, kind)).min().unwrap()
}

fn groups(xs: &[Vec<usize>]) -> BTreeMap<Vec<usize>, Vec<Vec<usize>>> {
    let mut groups = BTreeMap::new();
    for cols in xs {
        groups
            .entry(canonical(cols))
            .or_insert_with(Vec::new)
            .push(cols.clone());
    }
    groups
}

fn print_grid(cols: &[usize]) {
    for &queen_col in cols {
        for col in 1..=cols.len() {
            if col > 1 {
                print!(" ");
            }
            if col == queen_col {
                print!("Q");
            } else {
                print!(".");
            }
        }
        println!();
    }
}

fn parse_n() -> usize {
    let mut args = env::args();
    let program = args.next().unwrap_or_else(|| "enumerate".to_string());
    let Some(n) = args.next() else {
        eprintln!("usage: {program} N");
        process::exit(2);
    };
    if args.next().is_some() {
        eprintln!("usage: {program} N");
        process::exit(2);
    }
    match n.parse::<usize>() {
        Ok(n) if n > 0 => n,
        _ => {
            eprintln!("N must be a positive integer");
            process::exit(2);
        }
    }
}

fn main() {
    let n = parse_n();
    let xs = placements(n);
    let groups = groups(&xs);

    println!("n = {n}");
    println!("placements = {}", xs.len());
    println!("groups = {}", groups.len());
    println!();

    for (idx, (representative, members)) in groups.iter().enumerate() {
        println!("group {}", idx + 1);
        println!("representative: {}", label(representative));
        println!("size: {}", members.len());
        println!("grid:");
        print_grid(representative);
        println!("members:");
        for cols in members {
            println!("{}", label(cols));
        }
        println!();
    }

    println!("raw output:");
    for cols in xs {
        println!("{}", label(&cols));
    }
}
